import { LRUCache } from "lru-cache";
export const USER_AGENT = process.env.ASSET_SERVER_USER_AGENT ??
    "Mozilla/5.0 (compatible; 3d-asset-server/0.1; +https://github.com/arielshad/3d-asset-server)";
const DEFAULT_TIMEOUT_MS = Number(process.env.ASSET_SERVER_HTTP_TIMEOUT_MS ?? 15_000);
const DEFAULT_CACHE_TTL_MS = Number(process.env.ASSET_SERVER_CACHE_TTL_MS ?? 10 * 60_000);
export class HttpError extends Error {
    status;
    url;
    constructor(status, url, message) {
        super(message ?? `HTTP ${status} for ${url}`);
        this.status = status;
        this.url = url;
        this.name = "HttpError";
    }
}
export function createHttpClient(opts = {}) {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const defaultTtl = opts.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    const doFetch = opts.fetchImpl ?? fetch;
    const cache = new LRUCache({
        max: opts.cacheSize ?? 500,
        // Bound memory: some list endpoints (e.g. Poly Haven) return ~1MB JSON.
        maxSize: 64 * 1024 * 1024,
        sizeCalculation: (v) => v.length || 1,
    });
    const inflight = new Map();
    async function raw(url, init = {}) {
        const timeout = AbortSignal.timeout(timeoutMs);
        const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
        const res = await doFetch(url, {
            method: init.method ?? "GET",
            body: init.body,
            headers: {
                "user-agent": USER_AGENT,
                accept: "application/json, text/html;q=0.9, */*;q=0.8",
                "accept-language": "en-US,en;q=0.9",
                ...init.headers,
            },
            redirect: "follow",
            signal,
        });
        if (!res.ok) {
            // Drain the body so the socket can be reused.
            await res.body?.cancel().catch(() => undefined);
            throw new HttpError(res.status, url);
        }
        return res;
    }
    async function text(url, init = {}) {
        const ttl = init.cacheTtlMs ?? defaultTtl;
        const cacheable = (init.method ?? "GET") === "GET" && ttl > 0;
        const key = `${url}\n${JSON.stringify(init.headers ?? {})}`;
        if (cacheable) {
            const hit = cache.get(key);
            if (hit !== undefined)
                return hit;
            const pending = inflight.get(key);
            if (pending)
                return pending;
        }
        const p = (async () => {
            const res = await raw(url, init);
            const body = await res.text();
            if (cacheable)
                cache.set(key, body, { ttl });
            return body;
        })();
        if (cacheable) {
            inflight.set(key, p);
            p.finally(() => inflight.delete(key)).catch(() => undefined);
        }
        return p;
    }
    async function json(url, init = {}) {
        const body = await text(url, {
            ...init,
            headers: { accept: "application/json", ...init.headers },
        });
        try {
            return JSON.parse(body);
        }
        catch {
            throw new Error(`Invalid JSON from ${url}: ${body.slice(0, 120)}`);
        }
    }
    return { raw, text, json };
}
//# sourceMappingURL=http.js.map