/**
 * Shared domain model for every asset source.
 *
 * Providers translate their native data into these shapes so the aggregator,
 * HTTP API and MCP server never need to know which site an asset came from.
 */
export const ASSET_TYPES = [
    "model",
    "texture",
    "material",
    "hdri",
    "sprite",
    "ui",
    "audio",
    "font",
    "pack",
    "other",
];
//# sourceMappingURL=types.js.map