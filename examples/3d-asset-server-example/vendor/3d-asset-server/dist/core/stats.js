/**
 * Public usage statistics for the /stats page and GET /v1/stats.
 *
 * Two sources, same shape:
 * - PrometheusStats queries the cluster's Prometheus (PROMETHEUS_URL), so
 *   numbers survive restarts and cover every replica (last 24 hours / 7 days).
 * - LocalStats tallies this process's events since it started. It is the
 *   fallback when Prometheus is not configured or not reachable.
 *
 * Only aggregate counts leave the server: no queries, IPs or user agents.
 */
const SURFACES = ["web", "api", "mcp"];
const emptySurfaces = () => ({ web: 0, api: 0, mcp: 0 });
function rank(m, max = 10) {
    return [...m.entries()]
        .filter(([, n]) => n > 0)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, max);
}
function quantile(sorted, q) {
    if (!sorted.length)
        return null;
    const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
    return sorted[i];
}
const bump = (m, k, n = 1) => m.set(k, (m.get(k) ?? 0) + n);
/** Latency samples kept per source (most recent), enough for stable p50/p95. */
const LATENCY_SAMPLES = 500;
/** In-process tallies since start. Also an Analytics sink, so it sees every event. */
export class LocalStats {
    now;
    started;
    searches = 0;
    searchesWithResults = 0;
    bySurface = emptySurfaces();
    assetViews = 0;
    downloads = 0;
    toolCalls = 0;
    pageViews = 0;
    clients = new Map();
    tools = new Map();
    types = new Map();
    health = new Map();
    constructor(now = () => new Date()) {
        this.now = now;
        this.started = now();
    }
    search(e) {
        this.searches++;
        if (e.response.results.length > 0)
            this.searchesWithResults++;
        this.bySurface[e.surface]++;
        bump(this.clients, e.client);
        if (!e.types?.length)
            bump(this.types, "any");
        else
            for (const t of e.types)
                bump(this.types, t);
        for (const p of e.response.providers) {
            if (p.status !== "ok" && p.status !== "error" && p.status !== "timeout")
                continue;
            let h = this.health.get(p.provider);
            if (!h)
                this.health.set(p.provider, (h = { ok: 0, errors: 0, timeouts: 0, ms: [] }));
            if (p.status === "ok")
                h.ok++;
            else if (p.status === "error")
                h.errors++;
            else
                h.timeouts++;
            h.ms.push(p.tookMs);
            if (h.ms.length > LATENCY_SAMPLES)
                h.ms.shift();
        }
    }
    assetView(_e) {
        this.assetViews++;
    }
    download(_e) {
        this.downloads++;
    }
    toolCall(e) {
        this.toolCalls++;
        bump(this.tools, e.tool);
    }
    mcpConnect(_e) { }
    httpRequest(_e) { }
    pageView(_e) {
        this.pageViews++;
    }
    async snapshot() {
        const providers = [...this.health.entries()]
            .map(([provider, h]) => {
            const requests = h.ok + h.errors + h.timeouts;
            const sorted = [...h.ms].sort((a, b) => a - b);
            return {
                provider,
                requests,
                ok: h.ok,
                errors: h.errors,
                timeouts: h.timeouts,
                okRate: requests ? h.ok / requests : null,
                p50Ms: quantile(sorted, 0.5),
                p95Ms: quantile(sorted, 0.95),
            };
        })
            .sort((a, b) => a.provider.localeCompare(b.provider));
        return {
            generatedAt: this.now().toISOString(),
            source: "process",
            since: this.started.toISOString(),
            windows: [
                {
                    key: "process",
                    label: "Since the last restart",
                    searches: this.searches,
                    searchesWithResults: this.searchesWithResults,
                    bySurface: { ...this.bySurface },
                    assetViews: this.assetViews,
                    downloads: this.downloads,
                    toolCalls: this.toolCalls,
                    pageViews: this.pageViews,
                },
            ],
            breakdownLabel: "Since the last restart",
            clients: rank(this.clients),
            tools: rank(this.tools),
            assetTypes: rank(this.types),
            providers,
        };
    }
}
const WINDOWS = [
    { key: "24h", label: "Last 24 hours" },
    { key: "7d", label: "Last 7 days" },
];
/** Rankings use the longest window; provider health the shortest (it should reflect now). */
const BREAKDOWN = "7d";
const HEALTH = "24h";
/** Counts from the cluster's Prometheus, which scrapes METRICS_PORT on every replica. */
export class PrometheusStats {
    opts;
    base;
    fetchImpl;
    constructor(opts) {
        this.opts = opts;
        this.base = opts.url.replace(/\/+$/, "");
        this.fetchImpl = opts.fetch ?? fetch;
    }
    async snapshot() {
        try {
            return await this.query();
        }
        catch (e) {
            (this.opts.onError ?? ((err) => console.error("stats: prometheus query failed:", err)))(e);
            return this.opts.fallback.snapshot();
        }
    }
    async vector(promql) {
        const url = `${this.base}/api/v1/query?query=${encodeURIComponent(promql)}`;
        const res = await this.fetchImpl(url, { signal: AbortSignal.timeout(this.opts.timeoutMs ?? 4000) });
        if (!res.ok)
            throw new Error(`prometheus ${res.status} for ${promql}`);
        const body = (await res.json());
        if (body.status !== "success" || body.data?.resultType !== "vector")
            throw new Error(`prometheus: unexpected response for ${promql}`);
        return body.data.result;
    }
    async scalar(promql) {
        return count((await this.vector(promql))[0]);
    }
    /** Event counts per label value (rounded, NaN = 0). */
    async byLabel(promql, label) {
        const m = new Map();
        for (const s of await this.vector(promql))
            m.set(s.metric[label] ?? "unknown", count(s));
        return m;
    }
    /** Raw sample values per label value (NaN kept, for quantiles). */
    async valuesByLabel(promql, label) {
        const m = new Map();
        for (const s of await this.vector(promql))
            m.set(s.metric[label] ?? "unknown", Number(s.value[1]));
        return m;
    }
    async window(key, label) {
        const inc = (metric, sel = "") => `sum(increase(${metric}${sel}[${key}]))`;
        const [surfaces, withResults, assetViews, downloads, toolCalls, pageViews] = await Promise.all([
            this.byLabel(`sum by (surface) (increase(asset_server_searches_total[${key}]))`, "surface"),
            this.scalar(inc("asset_server_searches_total", `{has_results="true"}`)),
            this.scalar(inc("asset_server_asset_views_total")),
            this.scalar(inc("asset_server_downloads_total")),
            this.scalar(inc("asset_server_mcp_tool_calls_total")),
            this.scalar(inc("asset_server_page_views_total")),
        ]);
        const bySurface = emptySurfaces();
        for (const s of SURFACES)
            bySurface[s] = surfaces.get(s) ?? 0;
        return {
            key,
            label,
            searches: bySurface.web + bySurface.api + bySurface.mcp,
            searchesWithResults: withResults,
            bySurface,
            assetViews,
            downloads,
            toolCalls,
            pageViews,
        };
    }
    async query() {
        const [windows, clients, tools, types, outcomes, p50, p95] = await Promise.all([
            Promise.all(WINDOWS.map((w) => this.window(w.key, w.label))),
            this.byLabel(`sum by (client) (increase(asset_server_searches_total[${BREAKDOWN}]))`, "client"),
            this.byLabel(`sum by (tool) (increase(asset_server_mcp_tool_calls_total[${BREAKDOWN}]))`, "tool"),
            this.byLabel(`sum by (type) (increase(asset_server_searches_total[${BREAKDOWN}]))`, "type"),
            this.vector(`sum by (provider, status) (increase(asset_server_provider_requests_total{status=~"ok|error|timeout"}[${HEALTH}]))`),
            this.valuesByLabel(latency(0.5), "provider"),
            this.valuesByLabel(latency(0.95), "provider"),
        ]);
        const health = new Map();
        for (const s of outcomes) {
            const id = s.metric.provider ?? "unknown";
            const h = health.get(id) ?? { ok: 0, errors: 0, timeouts: 0 };
            const n = count(s);
            if (s.metric.status === "ok")
                h.ok += n;
            else if (s.metric.status === "error")
                h.errors += n;
            else
                h.timeouts += n;
            health.set(id, h);
        }
        const ms = (m, id) => {
            const v = m.get(id);
            return v === undefined || !Number.isFinite(v) ? null : Math.round(v * 1000);
        };
        const providers = [...health.entries()]
            .map(([provider, h]) => {
            const requests = h.ok + h.errors + h.timeouts;
            return {
                provider,
                requests,
                ...h,
                okRate: requests ? h.ok / requests : null,
                p50Ms: ms(p50, provider),
                p95Ms: ms(p95, provider),
            };
        })
            .filter((p) => p.requests > 0)
            .sort((a, b) => a.provider.localeCompare(b.provider));
        return {
            generatedAt: (this.opts.now?.() ?? new Date()).toISOString(),
            source: "prometheus",
            windows,
            breakdownLabel: WINDOWS.find((w) => w.key === BREAKDOWN).label,
            clients: rank(clients),
            tools: rank(tools),
            assetTypes: rank(types),
            providers,
        };
    }
}
function latency(q) {
    return `histogram_quantile(${q}, sum by (provider, le) (rate(asset_server_provider_duration_seconds_bucket[${HEALTH}])))`;
}
/** Prometheus `increase` extrapolates, so round to whole events; NaN (no data) counts as 0. */
function count(s) {
    if (!s)
        return 0;
    const v = Number(s.value[1]);
    return Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
}
/** Serve one snapshot for `ttlMs` so page loads don't each hit Prometheus. Concurrent callers share a request. */
export function cachedStats(source, ttlMs = 60_000, now = Date.now) {
    let cached;
    return {
        snapshot() {
            const t = now();
            if (!cached || t - cached.at >= ttlMs) {
                const value = source.snapshot();
                cached = { at: t, value };
                value.catch(() => {
                    if (cached?.value === value)
                        cached = undefined;
                });
            }
            return cached.value;
        },
    };
}
/** Fan one event out to several sinks (metrics + local stats). */
export function teeAnalytics(...sinks) {
    return {
        registry: sinks.find((s) => s.registry)?.registry,
        search: (e) => sinks.forEach((s) => s.search(e)),
        assetView: (e) => sinks.forEach((s) => s.assetView(e)),
        download: (e) => sinks.forEach((s) => s.download(e)),
        toolCall: (e) => sinks.forEach((s) => s.toolCall(e)),
        mcpConnect: (e) => sinks.forEach((s) => s.mcpConnect(e)),
        httpRequest: (e) => sinks.forEach((s) => s.httpRequest(e)),
        pageView: (e) => sinks.forEach((s) => s.pageView(e)),
    };
}
//# sourceMappingURL=stats.js.map