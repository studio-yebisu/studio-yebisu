import { createHttpClient } from "./http.js";
import { matchScore, parseAssetId } from "./util.js";
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;
/** Small boost for sources whose metadata and downloads we trust most. */
const ACCESS_WEIGHT = { api: 1, scrape: 0.8, link: 0 };
export class AssetService {
    http;
    providers = new Map();
    defaultTimeoutMs;
    constructor(opts) {
        this.http = opts.http ?? createHttpClient();
        this.defaultTimeoutMs = opts.defaultTimeoutMs ?? Number(process.env.ASSET_SERVER_PROVIDER_TIMEOUT_MS ?? 12_000);
        for (const p of opts.providers)
            this.providers.set(p.id, p);
    }
    listProviders() {
        return [...this.providers.values()].map((p) => ({
            id: p.id,
            name: p.name,
            homepage: p.homepage,
            description: p.description,
            assetTypes: p.assetTypes,
            access: p.access,
            pricing: p.pricing,
            license: p.license,
            apiKeyEnv: p.apiKeyEnv,
            supportsDownload: p.supportsDownload,
            enabled: p.isEnabled?.() ?? true,
        }));
    }
    getProvider(id) {
        return this.providers.get(id);
    }
    async search(req) {
        const limit = Math.min(Math.max(req.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
        const timeoutMs = req.timeoutMs ?? this.defaultTimeoutMs;
        const types = req.types?.length ? req.types : undefined;
        const wanted = req.providers?.length ? new Set(req.providers) : undefined;
        const unknown = req.providers?.filter((p) => !this.providers.has(p)) ?? [];
        if (unknown.length)
            throw new UnknownProviderError(unknown);
        // Ask each source for a full page so the merged ranking has enough to choose from.
        const perProvider = Math.min(limit, 50);
        const q = { query: req.query.trim(), types, freeOnly: req.freeOnly, limit: perProvider, offset: req.offset };
        const reports = [];
        const ranked = [];
        await Promise.all([...this.providers.values()].map(async (p) => {
            const started = Date.now();
            const base = { provider: p.id, name: p.name, count: 0 };
            const skip = (reason) => {
                reports.push({ ...base, status: "skipped", error: reason, tookMs: 0 });
            };
            if (wanted && !wanted.has(p.id))
                return;
            if (p.isEnabled && !p.isEnabled())
                return skip(`disabled (set ${p.apiKeyEnv ?? "its API key"})`);
            if (types && !types.some((t) => p.assetTypes.includes(t)))
                return skip("does not carry the requested types");
            if (req.downloadableOnly && !p.supportsDownload)
                return skip("no direct downloads");
            if (req.freeOnly && p.pricing === "paid")
                return skip("paid only");
            const searchUrl = p.buildSearchUrl(q);
            const signal = AbortSignal.timeout(timeoutMs);
            const ctx = { fetch: this.http, signal };
            try {
                const res = await withTimeout(p.search(q, ctx), timeoutMs, signal);
                let assets = res.assets;
                if (req.downloadableOnly)
                    assets = assets.filter((a) => a.downloadable);
                if (req.freeOnly)
                    assets = assets.filter((a) => a.price?.free !== false);
                assets.forEach((asset, rank) => ranked.push({ asset, rank, provider: p }));
                reports.push({
                    ...base,
                    status: p.access === "link" ? "link" : "ok",
                    count: assets.length,
                    total: res.total,
                    searchUrl: res.searchUrl ?? searchUrl,
                    tookMs: Date.now() - started,
                });
            }
            catch (e) {
                const timedOut = signal.aborted || e instanceof TimeoutError;
                reports.push({
                    ...base,
                    status: timedOut ? "timeout" : "error",
                    error: timedOut ? `timed out after ${timeoutMs}ms` : errorMessage(e),
                    searchUrl,
                    tookMs: Date.now() - started,
                });
            }
        }));
        const results = rankResults(ranked, q.query).slice(0, limit);
        const order = [...this.providers.keys()];
        reports.sort((a, b) => order.indexOf(a.provider) - order.indexOf(b.provider));
        return { query: q.query, types, results, providers: reports };
    }
    async getAsset(id) {
        const parsed = parseAssetId(id);
        if (!parsed)
            throw new InvalidAssetIdError(id);
        const p = this.providers.get(parsed.provider);
        if (!p)
            throw new UnknownProviderError([parsed.provider]);
        if (!p.getAsset)
            throw new UnsupportedError(`${p.name} does not support asset details; open the source site instead.`);
        const signal = AbortSignal.timeout(this.defaultTimeoutMs * 2);
        return p.getAsset(parsed.nativeId, { fetch: this.http, signal });
    }
}
/**
 * Merge per-provider results into one list.
 * Score = text relevance (dominant) + the source's own ranking + small boosts for
 * free / directly downloadable assets, then a diversity penalty so a single
 * large catalogue can't fill the whole first page.
 */
export function rankResults(items, query) {
    const scored = items.map(({ asset, rank, provider }) => {
        const relevance = matchScore(asset, query);
        const sourceRank = 1 / (1 + rank * 0.15);
        const score = 0.6 * relevance +
            0.2 * sourceRank +
            0.1 * ACCESS_WEIGHT[provider.access] +
            0.05 * (asset.price?.free ? 1 : 0) +
            0.05 * (asset.downloadable ? 1 : 0);
        return { asset, provider: provider.id, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const seenPerProvider = new Map();
    const diversified = scored.map((s) => {
        const n = seenPerProvider.get(s.provider) ?? 0;
        seenPerProvider.set(s.provider, n + 1);
        return { ...s, score: s.score * Math.pow(0.93, n) };
    });
    diversified.sort((a, b) => b.score - a.score);
    return diversified.map((s) => ({ ...s.asset, score: round(s.score) }));
}
function round(n) {
    return Math.round(n * 1000) / 1000;
}
class TimeoutError extends Error {
}
function withTimeout(p, ms, signal) {
    return new Promise((resolve, reject) => {
        const onAbort = () => reject(new TimeoutError(`timed out after ${ms}ms`));
        if (signal.aborted)
            return onAbort();
        signal.addEventListener("abort", onAbort, { once: true });
        p.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
    });
}
export function errorMessage(e) {
    return e instanceof Error ? e.message : String(e);
}
export class UnknownProviderError extends Error {
    ids;
    constructor(ids) {
        super(`Unknown provider(s): ${ids.join(", ")}`);
        this.ids = ids;
        this.name = "UnknownProviderError";
    }
}
export class InvalidAssetIdError extends Error {
    constructor(id) {
        super(`Invalid asset id "${id}". Expected "<provider>:<id>", e.g. "polyhaven:ArmChair_01".`);
        this.name = "InvalidAssetIdError";
    }
}
export class UnsupportedError extends Error {
    constructor(message) {
        super(message);
        this.name = "UnsupportedError";
    }
}
//# sourceMappingURL=service.js.map