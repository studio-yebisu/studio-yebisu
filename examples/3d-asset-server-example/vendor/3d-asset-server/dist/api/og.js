import { assetCard, fetchImage, pageCard, renderPng } from "../og/render.js";
import { allProviders } from "../providers/index.js";
import { ASSET_TYPE_LABEL, searchShare } from "./search-meta.js";
export class OgImages {
    service;
    opts;
    cache = new Map();
    running = 0;
    waiting = [];
    constructor(service, opts) {
        this.service = service;
        this.opts = opts;
    }
    /** Card for a /search share link; null when the parameters describe no search. */
    query(params) {
        const share = searchShare(params);
        if (!share)
            return Promise.resolve(null);
        return this.cached(`q:${share.key}`, () => renderPng(pageCard({ kicker: share.kicker, title: share.title, subtitle: share.subtitle, chips: share.chips, site: this.opts.site })));
    }
    /** Card for an asset share link; null when the asset doesn't exist or can't be looked up. */
    asset(id) {
        return this.cached(`a:${id}`, async () => {
            const a = await this.service.getAsset(id).catch(() => null);
            if (!a)
                return null;
            const image = a.thumbnailUrl ? await fetchImage(a.thumbnailUrl, { fetch: this.opts.fetch }) : undefined;
            return renderPng(assetCard({
                title: a.title,
                source: allProviders.find((p) => p.id === a.provider)?.name ?? a.provider,
                type: ASSET_TYPE_LABEL[a.type] ?? "Asset",
                license: a.license?.name,
                free: a.price?.free,
                formats: a.formats,
                author: a.author,
                image,
                site: this.opts.site,
            }));
        });
    }
    cached(key, make) {
        const hit = this.cache.get(key);
        if (hit) {
            // Refresh recency.
            this.cache.delete(key);
            this.cache.set(key, hit);
            return hit;
        }
        const value = this.limit(make);
        this.cache.set(key, value);
        // Don't keep failures or misses: the asset may appear, the source may recover.
        value.then((v) => v === null && this.cache.delete(key)).catch(() => this.cache.delete(key));
        while (this.cache.size > (this.opts.maxEntries ?? 300))
            this.cache.delete(this.cache.keys().next().value);
        return value;
    }
    async limit(fn) {
        if (this.running >= (this.opts.concurrency ?? 2))
            await new Promise((r) => this.waiting.push(r));
        this.running++;
        try {
            return await fn();
        }
        finally {
            this.running--;
            this.waiting.shift()?.();
        }
    }
}
//# sourceMappingURL=og.js.map