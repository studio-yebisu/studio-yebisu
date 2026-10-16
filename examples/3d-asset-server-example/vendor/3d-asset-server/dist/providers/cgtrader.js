import * as cheerio from "cheerio";
import { cleanText, makeAsset, qs, uniq, wantsType } from "../core/util.js";
/**
 * CGTrader (https://www.cgtrader.com): marketplace of free and paid 3D models.
 *
 * Search: the listing pages (`/search?free=1&keywords=...`) are a React app that serves
 * its own state as JSON when requested with `Accept: application/json` (the same request
 * the site's client-side navigation makes). Results come in fixed pages of 120.
 * Details: the product page HTML carries schema.org JSON-LD plus the item data as
 * `data-react-props` on the `ItemPage/TopSection/TopSection` component.
 * Downloads (even free ones) need a logged-in account, so files are listed with
 * `requiresAuth: true`.
 */
const SITE = "https://www.cgtrader.com";
const PAGE_SIZE = 120;
const DESCRIPTION_MAX = 600;
const ROYALTY_FREE = {
    name: "Royalty Free",
    url: `${SITE}/pages/terms-and-conditions#royalty-free-license`,
    commercialUse: true,
    attributionRequired: false,
};
const LICENSE_MAP = {
    royalty_free: ROYALTY_FREE,
    royalty_free_no_ai: { ...ROYALTY_FREE, name: "Royalty Free (no AI)" },
    editorial: { name: "Editorial", url: `${SITE}/pages/terms-and-conditions`, commercialUse: false },
};
/** Product-page format titles that are not simply the extension. */
const FORMAT_ALIASES = {
    blender: "blend",
    "cinema 4d": "c4d",
    "3ds max": "max",
    "autodesk 3ds max": "max",
    maya: "ma",
    collada: "dae",
    sketchup: "skp",
    "autodesk fbx": "fbx",
    jpeg: "jpg",
    tiff: "tif",
};
const NOT_FORMATS = new Set(["textures", "other", "materials"]);
function normFormat(name) {
    if (!name)
        return undefined;
    const n = name.trim().toLowerCase().replace(/^\./, "");
    if (!n || NOT_FORMATS.has(n))
        return undefined;
    if (FORMAT_ALIASES[n])
        return FORMAT_ALIASES[n];
    return /^[a-z0-9]{1,12}$/.test(n) ? n : undefined;
}
/** Last path segment of a product URL; `/3d-model/<slug>` redirects to the canonical page. */
function slugOf(url) {
    const path = new URL(url, SITE).pathname.replace(/\/+$/, "");
    return path.slice(path.lastIndexOf("/") + 1);
}
function truncate(s, max) {
    return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}
function listingToAsset(item) {
    const a = item.attributes;
    const t = a.modelInfo?.types ?? {};
    const free = !a.price;
    const desc = cleanText(a.description);
    return makeAsset({
        provider: "cgtrader",
        nativeId: slugOf(a.url),
        title: cleanText(a.title),
        description: desc ? truncate(desc, DESCRIPTION_MAX) : undefined,
        type: "model",
        tags: [a.categorySlug, a.subcategorySlug, t.printReady ? "3d print" : undefined, t.pbr ? "pbr" : undefined, t.lowPoly ? "low poly" : undefined].filter((x) => !!x),
        categories: uniq([a.categoryTitle, a.subcategoryTitle].filter((x) => !!x)),
        url: a.url,
        thumbnailUrl: a.primaryImage?.gridFallbackUrl || a.primaryImage?.gridUrl || a.schemaImageUrl,
        price: free ? { free: true } : { free: false, amount: a.price, currency: "USD" },
        formats: uniq((a.metaverseFormatsList ?? []).map((f) => normFormat(f.name)).filter((f) => !!f)),
        animated: t.animated,
        rigged: t.rigged,
        downloadable: false,
    });
}
function searchUrl(q, page) {
    // Parameter order matters: anything else is 301-redirected to page, free, keywords.
    return `${SITE}/search${qs({ page: page > 1 ? page : undefined, free: q.freeOnly ? 1 : undefined, keywords: q.query.trim() })}`;
}
function parseSize(s) {
    const m = /^([\d.]+)\s*(B|KB|MB|GB)$/i.exec(s?.trim() ?? "");
    if (!m)
        return undefined;
    const mult = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 }[m[2].toUpperCase()];
    return Math.round(parseFloat(m[1]) * mult);
}
function findProduct($) {
    for (const el of $('script[type="application/ld+json"]').toArray()) {
        try {
            const data = JSON.parse($(el).text());
            const nodes = Array.isArray(data["@graph"]) ? data["@graph"] : [data];
            const p = nodes.find((n) => n?.["@type"] === "Product");
            if (p)
                return p;
        }
        catch {
            // ignore malformed blocks
        }
    }
    return undefined;
}
function parseProductPage(html, fallbackSlug) {
    const $ = cheerio.load(html);
    const product = findProduct($);
    const propsRaw = $('[data-react-class="ItemPage/TopSection/TopSection"]').attr("data-react-props");
    if (!product && !propsRaw)
        return null;
    let top = {};
    if (propsRaw) {
        try {
            top = JSON.parse(propsRaw);
        }
        catch {
            top = {};
        }
    }
    const url = product?.url || $('link[rel="canonical"]').attr("href") || `${SITE}/3d-model/${fallbackSlug}`;
    const pricing = top.pricingArea ?? {};
    const details = top.detailsArea ?? {};
    const title = cleanText((product?.name ?? pricing.title ?? fallbackSlug).replace(/\s*\|\s*3D model\s*$/i, ""));
    const offerPrice = Number(product?.offers?.price ?? pricing.price?.replace(/[^\d.]/g, ""));
    const free = pricing.free ?? !(offerPrice > 0);
    const images = Array.isArray(product?.image) ? product.image : product?.image ? [product.image] : [];
    const thumb = top.galleryArea?.medias?.[0]?.imageNameThumb || images[0]?.contentUrl || $('meta[property="og:image"]').attr("content");
    const descHtml = top.descriptionArea?.description;
    // Keep block/line breaks as spaces so "Name: X<br>Type: Y" does not run together.
    const descText = descHtml ? cleanText(cheerio.load(descHtml.replace(/<br\s*\/?>|<\/(?:p|div|li|h\d)>/gi, " $&")).text()) : "";
    const description = descText ? truncate(descText, DESCRIPTION_MAX * 3) : undefined;
    const crumbs = (top.descriptionArea?.breadcrumbs ?? []).map((b) => cleanText(b.title)).filter(Boolean);
    // Breadcrumbs: [section, category, subcategory, item title].
    const categories = crumbs.slice(1, -1);
    const nativeFormats = new Set((details.nativeFormats ?? []).map((f) => normFormat(f.title)));
    const formatsList = [...(details.nativeFormats ?? []), ...(details.exchangeFormats ?? [])];
    const files = [];
    const seen = new Set();
    for (const f of formatsList) {
        const format = normFormat(f.title);
        if (!format || seen.has(format))
            continue;
        seen.add(format);
        files.push({
            url,
            filename: `${slugOf(url)}.${format}`,
            format,
            sizeBytes: parseSize(f.fileSize),
            group: nativeFormats.has(format) ? "native" : "exchange",
            requiresAuth: true,
        });
    }
    const asset = makeAsset({
        provider: "cgtrader",
        nativeId: slugOf(url),
        title,
        description,
        type: "model",
        tags: [
            ...(top.descriptionArea?.relatedTags ?? []).map((t) => cleanText(t.text)).filter(Boolean),
            ...(details.readyFor3dPrinting ? ["3d print"] : []),
            ...(details.pbr ? ["pbr"] : []),
        ],
        categories: categories.length ? categories : undefined,
        url,
        thumbnailUrl: thumb,
        author: top.sellerArea?.designerName || product?.brand?.name,
        license: pricing.license ? (LICENSE_MAP[pricing.license] ?? { name: "Custom", url: `${SITE}/pages/terms-and-conditions` }) : undefined,
        price: free
            ? { free: true }
            : { free: false, amount: offerPrice > 0 ? offerPrice : undefined, currency: product?.offers?.priceCurrency ?? "USD" },
        formats: files.length ? files.map((f) => f.format) : undefined,
        polyCount: details.polygons ?? undefined,
        animated: details.animated,
        rigged: details.rigged,
        downloadable: false,
        createdAt: details.publishDate,
    });
    return { ...asset, files };
}
const WAF_MARKERS = /awsWafCookieDomainList|AwsWafIntegration|\.awswaf\.com\//;
/** Thrown when CGTrader's AWS WAF answers with a JavaScript challenge instead of content. */
export class CgtraderBlockedError extends Error {
    url;
    constructor(url) {
        super(`CGTrader bot protection (AWS WAF challenge) blocked automated access from this network (common for cloud/datacenter IPs). Open ${url} in a browser instead.`);
        this.url = url;
        this.name = "CgtraderBlockedError";
    }
}
/**
 * GET via `raw` rather than `text`/`json` so a WAF challenge (HTTP 202, empty or JS body)
 * is detected and never stored in the response cache.
 */
async function fetchBody(url, accept, ctx, humanUrl = url) {
    const res = await ctx.fetch.raw(url, { headers: { accept }, signal: ctx.signal });
    const body = await res.text();
    if (res.headers.get("x-amzn-waf-action") || (res.status === 202 && !body) || WAF_MARKERS.test(body.slice(0, 4000))) {
        throw new CgtraderBlockedError(humanUrl);
    }
    return body;
}
export const cgtrader = {
    id: "cgtrader",
    name: "CGTrader",
    homepage: SITE,
    description: "Large marketplace of free and paid 3D models (game, archviz, 3D print); downloads need a CGTrader account.",
    assetTypes: ["model"],
    access: "scrape",
    pricing: "freemium",
    supportsDownload: false,
    async census(ctx) {
        const [all, free] = await Promise.all([
            this.search({ query: "", limit: 1 }, ctx),
            this.search({ query: "", limit: 1, freeOnly: true }, ctx),
        ]);
        if (all.total === undefined)
            throw new Error("cgtrader: listing without totalCount");
        return { total: all.total, free: free.total, byType: { model: all.total }, method: "CGTrader listing: totalCount for all and free models" };
    },
    buildSearchUrl(q) {
        if (!q.query.trim())
            return `${SITE}/${q.freeOnly ? "free-3d-models" : "3d-models"}`;
        return searchUrl(q, 1);
    },
    async search(q, ctx) {
        if (!wantsType(q, "model"))
            return { assets: [] };
        const offset = q.offset ?? 0;
        const firstPage = Math.floor(offset / PAGE_SIZE) + 1;
        const skip = offset - (firstPage - 1) * PAGE_SIZE;
        const fetchPage = async (page) => {
            const url = searchUrl(q, page);
            // The listing page serves its React state as JSON for `Accept: application/json`.
            const body = await fetchBody(url, "application/json", ctx, this.buildSearchUrl(q));
            try {
                return JSON.parse(body);
            }
            catch {
                throw new Error(`Invalid JSON from ${url}: ${body.slice(0, 120)}`);
            }
        };
        const first = await fetchPage(firstPage);
        let items = (first.data ?? []).filter((d) => d?.type === "listingItem" && d.attributes?.url);
        const totalPages = first.meta?.totalPages ?? 0;
        if (skip + q.limit > PAGE_SIZE && firstPage < totalPages) {
            const next = await fetchPage(firstPage + 1);
            items = items.concat((next.data ?? []).filter((d) => d?.type === "listingItem" && d.attributes?.url));
        }
        let assets = items.slice(skip, skip + q.limit).map(listingToAsset);
        if (q.freeOnly)
            assets = assets.filter((a) => a.price?.free);
        return { assets, total: first.meta?.totalCount, searchUrl: this.buildSearchUrl(q) };
    },
    async getAsset(nativeId, ctx) {
        if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(nativeId))
            return null;
        let html;
        try {
            // `/3d-model/<slug>` 301s to the canonical product URL; it returns 406 for application/json.
            html = await fetchBody(`${SITE}/3d-model/${nativeId}`, "text/html", ctx);
        }
        catch (e) {
            // Unknown slugs redirect to /not_found (404).
            const status = e.status;
            if (status === 404 || status === 410)
                return null;
            throw e;
        }
        return parseProductPage(html, nativeId);
    },
};
//# sourceMappingURL=cgtrader.js.map