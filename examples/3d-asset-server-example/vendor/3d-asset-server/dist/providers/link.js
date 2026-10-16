/**
 * Provider for sites that block automated access (Cloudflare/bot walls) or have
 * no public API. Search returns no assets, only a deep link to the site's own
 * search so agents and users can continue there.
 */
export function linkProvider(spec) {
    return {
        ...spec,
        access: "link",
        supportsDownload: false,
        async search(q) {
            return { assets: [], searchUrl: spec.buildSearchUrl(q) };
        },
    };
}
//# sourceMappingURL=link.js.map