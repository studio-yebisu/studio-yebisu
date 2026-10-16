import * as cheerio from "cheerio";
import { cleanText, filenameFromUrl, formatFromFilename, makeAsset, qs, typeMatches, wantsType } from "../core/util.js";
import { mapLimit, wpTotal } from "../core/census.js";
/**
 * HDRMAPS — WooCommerce shop of HDRIs (plus sky domes, 3D scans, bundles), with a "Freebies"
 * category of free HDRIs.
 *
 * Search uses the public WooCommerce Store API (`/wp-json/wc/store/v1/products`), which returns
 * prices, categories, tags, attributes and images. Free items (price 0, category "freebies")
 * have direct `dl.hdrmaps.com` EXR links on their product page; paid items need a purchase.
 */
const SITE = "https://hdrmaps.com";
const STORE = `${SITE}/wp-json/wc/store/v1/products`;
/** Store category ids (stable WooCommerce term ids). */
const CAT = {
    hdri: 52,
    skyDomes: 57,
    footage: 63,
    freebies: 64,
    bundles: 75,
    scans: 661,
    photogrammetry: 782,
    addons: 1533,
};
/**
 * Hidden reseller / partner products ("HDRI Map 947" etc. without images) and Poly Haven
 * sponsorship items that the Store API lists but the shop front does not.
 */
const HIDDEN_CATS = [3129, 3130, 3131, 3132, 3133, 3134, 3148, 2874, 15];
const HIDDEN_SLUG = /^(hs_|hd_hdri-skies|reseller$|polyhaven$|uncategorized$)/;
const LICENSE = {
    name: "Royalty Free",
    url: `${SITE}/terms-of-use/`,
    commercialUse: true,
    attributionRequired: false,
};
const FIELDS = "id,name,slug,permalink,type,short_description,prices,images,categories,tags,attributes";
function htmlText(html) {
    if (!html)
        return "";
    return cleanText(cheerio.load(`<div>${html}</div>`)("div").first().text());
}
function typeOf(cats) {
    const slugs = new Set(cats.map((c) => c.slug));
    if (slugs.has("3d-scans") || slugs.has("photogrammetry"))
        return "model";
    if (slugs.has("bundles"))
        return "pack";
    if (slugs.has("footage") || slugs.has("ht") || slugs.has("blender-addons"))
        return "other";
    return "hdri";
}
function attr(p, name) {
    return p.attributes?.find((a) => a.name.toLowerCase() === name.toLowerCase())?.terms.map((t) => t.name) ?? [];
}
/** "10000x5000" -> "10k". */
function resolutionFromDims(dims) {
    const w = Number(/^(\d+)\s*x/i.exec(dims ?? "")?.[1]);
    return w >= 1000 ? `${Math.round(w / 1000)}k` : undefined;
}
function priceOf(p) {
    const pr = p.prices;
    if (!pr)
        return undefined;
    const raw = Number(pr.price_range?.min_amount ?? pr.price);
    if (!Number.isFinite(raw))
        return undefined;
    const amount = raw / 10 ** (pr.currency_minor_unit ?? 2);
    return amount === 0 ? { free: true } : { free: false, amount, currency: pr.currency_code };
}
function isHidden(p) {
    const cats = p.categories ?? [];
    return cats.length > 0 && cats.every((c) => HIDDEN_SLUG.test(c.slug));
}
function toAsset(p) {
    const cats = p.categories ?? [];
    const type = typeOf(cats);
    const price = priceOf(p);
    const free = price?.free === true;
    const resolution = resolutionFromDims(attr(p, "HDRI Resolution")[0]);
    const meta = ["Time", "Weather", "Location", "Environment", "Country"].flatMap((a) => attr(p, a));
    return makeAsset({
        provider: "hdrmaps",
        nativeId: p.slug,
        title: htmlText(p.name) || p.slug,
        description: htmlText(p.short_description) || undefined,
        type,
        tags: [...(p.tags ?? []).map((t) => htmlText(t.name)), ...meta],
        categories: cats.length ? cats.map((c) => htmlText(c.name)) : undefined,
        url: p.permalink,
        thumbnailUrl: p.images?.[0]?.thumbnail ?? p.images?.[0]?.src,
        license: LICENSE,
        price,
        formats: type === "hdri" ? ["exr"] : undefined,
        resolutions: resolution ? [resolution] : undefined,
        // Freebies link straight to EXR files on dl.hdrmaps.com.
        downloadable: free && type === "hdri",
    });
}
/** "462.28 MB" -> bytes. */
function parseSize(s) {
    const m = /([\d.]+)\s*(KB|MB|GB)/i.exec(s ?? "");
    if (!m)
        return undefined;
    const mult = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 }[m[2].toUpperCase()];
    return Math.round(Number(m[1]) * mult);
}
/** Free product page: `<select id="freebiesResolutionSelect"><option value="https://dl.hdrmaps.com/…_4K.exr" data-size="80 MB">4K</option>`. */
export function parseFreebieFiles(html) {
    const $ = cheerio.load(html);
    const files = [];
    const seen = new Set();
    const add = (url, label, size) => {
        if (!url || seen.has(url))
            return;
        let host;
        try {
            host = new URL(url).hostname;
        }
        catch {
            return;
        }
        if (host !== "dl.hdrmaps.com")
            return;
        seen.add(url);
        const filename = filenameFromUrl(url);
        const res = /(\d+)\s*K\b/i.exec(label)?.[1] ?? /_(\d+)K\.\w+$/i.exec(filename)?.[1];
        files.push({
            url,
            filename,
            format: formatFromFilename(filename),
            resolution: res ? `${res}k` : undefined,
            sizeBytes: parseSize(size),
            group: "hdri",
        });
    };
    $('option[value*="dl.hdrmaps.com"]').each((_, el) => {
        add($(el).attr("value"), $(el).text(), $(el).attr("data-size"));
    });
    $('a[href*="dl.hdrmaps.com"]').each((_, el) => {
        add($(el).attr("href"), $(el).text());
    });
    return files;
}
export const hdrmaps = {
    id: "hdrmaps",
    name: "HDRMAPS",
    homepage: SITE,
    description: "High-resolution HDRIs and sky domes (paid shop) plus a set of free HDRIs with direct EXR downloads.",
    assetTypes: ["hdri", "model", "pack", "other"],
    access: "api",
    pricing: "freemium",
    license: LICENSE,
    supportsDownload: true,
    async census(ctx) {
        const count = (category, operator) => wpTotal(ctx.fetch, `${STORE}${qs({ per_page: 1, category, category_operator: operator, _fields: "id" })}`, ctx.signal);
        const total = await count(HIDDEN_CATS.join(","), "not_in");
        const [hdri, skyDomes, scans, photogrammetry, bundles, footage, addons, freebies] = await mapLimit([CAT.hdri, CAT.skyDomes, CAT.scans, CAT.photogrammetry, CAT.bundles, CAT.footage, CAT.addons, CAT.freebies], 3, (c) => count(String(c)));
        return {
            total,
            free: freebies,
            byType: { hdri: hdri + skyDomes, model: scans + photogrammetry, pack: bundles, other: footage + addons },
            categories: { HDRIs: hdri, "Sky domes": skyDomes, "3D scans": scans, Photogrammetry: photogrammetry, Bundles: bundles, Footage: footage, "Add-ons": addons, Freebies: freebies },
            method: "WooCommerce Store API: X-WP-Total per shop category",
        };
    },
    buildSearchUrl(q) {
        return `${SITE}/${qs({ s: q.query, post_type: "product" })}`;
    },
    async search(q, ctx) {
        if (!wantsType(q, "hdri", "model", "pack", "other"))
            return { assets: [] };
        // Narrow by category server-side where possible so paging stays accurate.
        let category;
        let operator;
        if (q.freeOnly) {
            category = String(CAT.freebies);
            operator = "in";
        }
        else if (q.types?.length) {
            const ids = [];
            if (wantsType(q, "hdri"))
                ids.push(CAT.hdri, CAT.skyDomes, CAT.freebies);
            if (wantsType(q, "model"))
                ids.push(CAT.scans, CAT.photogrammetry);
            if (wantsType(q, "pack"))
                ids.push(CAT.bundles);
            if (wantsType(q, "other"))
                ids.push(CAT.footage, CAT.addons);
            category = ids.join(",");
            operator = "in";
        }
        else {
            category = HIDDEN_CATS.join(",");
            operator = "not_in";
        }
        const url = STORE +
            qs({
                search: q.query.trim() || undefined,
                per_page: Math.max(1, Math.min(q.limit, 100)),
                offset: q.offset || undefined,
                category,
                category_operator: operator === "in" ? undefined : operator,
                _fields: FIELDS,
            });
        const products = await ctx.fetch.json(url, { signal: ctx.signal });
        if (!Array.isArray(products))
            throw new Error("hdrmaps: unexpected Store API response");
        let assets = products.filter((p) => !isHidden(p)).map(toAsset);
        assets = assets.filter((a) => typeMatches(a.type, q.types));
        if (q.freeOnly)
            assets = assets.filter((a) => a.price?.free);
        return { assets: assets.slice(0, q.limit), searchUrl: this.buildSearchUrl(q) };
    },
    async getAsset(nativeId, ctx) {
        const products = await ctx.fetch.json(`${STORE}${qs({ slug: nativeId })}`, { signal: ctx.signal });
        const p = Array.isArray(products) ? products[0] : undefined;
        if (!p)
            return null;
        const asset = toAsset(p);
        let files = [];
        if (asset.price?.free) {
            const html = await ctx.fetch.text(p.permalink, { signal: ctx.signal });
            files = parseFreebieFiles(html);
        }
        return {
            ...asset,
            downloadable: files.length > 0,
            resolutions: files.length ? files.flatMap((f) => (f.resolution ? [f.resolution] : [])) : asset.resolutions,
            files,
        };
    },
};
//# sourceMappingURL=hdrmaps.js.map