import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import { basename, dirname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Zip, ZipPassThrough, unzipSync } from "fflate";
/** What to fetch when the caller doesn't say: web/game-friendly formats first. */
const DEFAULT_FORMATS = {
    model: ["glb", "gltf", "fbx", "obj", "blend", "zip", "usd"],
    hdri: ["hdr", "exr", "zip", "jpg"],
    material: ["jpg", "png", "zip", "gltf", "blend"],
    texture: ["jpg", "png", "zip", "exr"],
    sprite: ["zip", "png"],
    ui: ["zip", "png", "svg"],
    audio: ["zip", "ogg", "wav", "mp3"],
    font: ["zip", "ttf", "otf"],
    pack: ["zip"],
    other: ["zip"],
};
const DEFAULT_RESOLUTION = "2k";
function resolutionValue(res) {
    const m = /^(\d+(?:\.\d+)?)\s*k$/i.exec(res.trim());
    if (m)
        return Number(m[1]) * 1024;
    const px = /^(\d+)/.exec(res.trim());
    return px ? Number(px[1]) : Number.NaN;
}
function matchesFormat(f, fmt) {
    const want = fmt.toLowerCase().replace(/^\./, "");
    const norm = want === "jpeg" ? "jpg" : want;
    return f.format === norm || f.group === norm;
}
/**
 * Pick the files to download for an asset.
 * Defaults: the first preferred format available for the asset type, at the
 * resolution closest to 2k. Texture maps (group "maps") come back as a set.
 */
export function selectFiles(asset, sel = {}) {
    let files = asset.files.filter((f) => !f.requiresAuth);
    if (sel.all || files.length <= 1)
        return files;
    if (sel.format) {
        files = files.filter((f) => matchesFormat(f, sel.format));
    }
    else {
        for (const fmt of DEFAULT_FORMATS[asset.type] ?? ["zip"]) {
            const hit = files.filter((f) => matchesFormat(f, fmt));
            if (hit.length) {
                files = hit;
                break;
            }
        }
    }
    // Texture-map sets: prefer one map per type (e.g. OpenGL normal over DirectX).
    if (sel.mapTypes?.length) {
        const wanted = sel.mapTypes.map((m) => m.toLowerCase());
        files = files.filter((f) => !f.mapType || wanted.some((w) => f.mapType.includes(w)));
    }
    const withRes = files.filter((f) => f.resolution && !Number.isNaN(resolutionValue(f.resolution)));
    if (withRes.length) {
        const target = resolutionValue(sel.resolution ?? DEFAULT_RESOLUTION);
        const available = [...new Set(withRes.map((f) => f.resolution))];
        // Closest resolution; on ties prefer the smaller download.
        available.sort((a, b) => {
            const da = Math.abs(resolutionValue(a) - target);
            const db = Math.abs(resolutionValue(b) - target);
            return da - db || resolutionValue(a) - resolutionValue(b);
        });
        const chosen = available[0];
        files = files.filter((f) => !f.resolution || f.resolution === chosen);
    }
    if (!sel.format) {
        // Same format from several packages (e.g. a standard and a Godot GLB): keep the first package.
        const groups = [...new Set(files.map((f) => f.group).filter((g) => g && g !== "maps"))];
        if (groups.length > 1)
            files = files.filter((f) => !f.group || f.group === "maps" || f.group === groups[0]);
        // Several archives left (e.g. JPG and PNG zips at the same res): keep the first.
        const archives = files.filter((f) => f.format === "zip");
        if (archives.length > 1 && archives.length === files.length)
            files = archives.slice(0, 1);
    }
    return files;
}
export function totalBytes(files) {
    let sum = 0;
    for (const f of files) {
        if (f.sizeBytes === undefined)
            return undefined;
        sum += f.sizeBytes;
        for (const inc of f.includes ?? []) {
            if (inc.sizeBytes === undefined)
                return undefined;
            sum += inc.sizeBytes;
        }
    }
    return sum;
}
/** Flatten main files + companions into (relativePath, url) pairs. */
export function expandFiles(files) {
    const out = new Map();
    for (const f of files) {
        out.set(safeRelative(f.filename), { path: safeRelative(f.filename), url: f.url, sizeBytes: f.sizeBytes });
        for (const inc of f.includes ?? []) {
            const p = safeRelative(inc.path);
            out.set(p, { path: p, url: inc.url, sizeBytes: inc.sizeBytes });
        }
    }
    return [...out.values()];
}
/** Normalise a relative path and refuse anything that escapes its root. */
export function safeRelative(p) {
    const parts = p.replace(/\\/g, "/").split("/").filter((s) => s && s !== ".");
    if (parts.some((s) => s === ".."))
        throw new Error(`Unsafe path in asset file list: ${p}`);
    const joined = parts.join("/");
    if (!joined)
        throw new Error(`Empty path in asset file list`);
    return joined;
}
const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i;
/** Refuse non-http(s) URLs and obvious internal targets (scraped pages are untrusted). */
export function assertPublicUrl(url) {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:")
        throw new Error(`Refusing non-HTTP URL: ${url}`);
    const host = u.hostname.replace(/^\[|\]$/g, "");
    if (PRIVATE_HOST.test(host))
        throw new Error(`Refusing internal host: ${host}`);
    if (isIP(host)) {
        const private4 = /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;
        if (private4.test(host) || host === "::1" || /^f[cd]|^fe80/i.test(host)) {
            throw new Error(`Refusing private address: ${host}`);
        }
    }
    return u;
}
export const DEFAULT_MAX_DOWNLOAD_BYTES = Number(process.env.ASSET_SERVER_MAX_DOWNLOAD_BYTES ?? 2 * 1024 ** 3);
/**
 * Download files (and their companions) into `destDir`, preserving relative
 * paths so e.g. a .gltf finds its textures.
 */
export async function downloadFiles(http, files, destDir, opts = {}) {
    const maxBytes = opts.maxBytes ?? DEFAULT_MAX_DOWNLOAD_BYTES;
    const known = totalBytes(files);
    if (known !== undefined && known > maxBytes) {
        throw new Error(`Selection is ${formatBytes(known)}, above the ${formatBytes(maxBytes)} limit. Pick a lower resolution.`);
    }
    const root = resolve(destDir);
    await mkdir(root, { recursive: true });
    const written = [];
    let bytes = 0;
    for (const item of expandFiles(files)) {
        assertPublicUrl(item.url);
        const target = resolve(root, item.path);
        if (target !== root && !target.startsWith(root + sep))
            throw new Error(`Unsafe path: ${item.path}`);
        if (!opts.overwrite && (await exists(target))) {
            written.push(target);
            continue;
        }
        await mkdir(dirname(target), { recursive: true });
        const res = await http.raw(item.url, { headers: { accept: "*/*" } });
        if (!res.body)
            throw new Error(`Empty response for ${item.url}`);
        let received = 0;
        const counter = new TransformStream({
            transform(chunk, ctrl) {
                received += chunk.byteLength;
                if (bytes + received > maxBytes)
                    ctrl.error(new Error(`Download exceeded ${formatBytes(maxBytes)} limit`));
                else
                    ctrl.enqueue(chunk);
            },
        });
        try {
            await pipeline(Readable.fromWeb(res.body.pipeThrough(counter)), createWriteStream(target));
        }
        catch (e) {
            await rm(target, { force: true });
            throw e;
        }
        bytes += received;
        if (opts.extract && item.path.toLowerCase().endsWith(".zip")) {
            const outDir = target.slice(0, -4);
            written.push(...(await extractZip(target, outDir)));
            await rm(target, { force: true });
        }
        else {
            written.push(target);
        }
    }
    return { directory: root, files: written, bytes };
}
async function extractZip(zipPath, outDir) {
    const data = new Uint8Array(await readFile(zipPath));
    const entries = unzipSync(data);
    const root = resolve(outDir);
    const out = [];
    for (const [name, content] of Object.entries(entries)) {
        if (name.endsWith("/") || name.startsWith("__MACOSX/"))
            continue;
        let rel;
        try {
            rel = safeRelative(name);
        }
        catch {
            continue; // skip zip-slip entries
        }
        const target = join(root, rel);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content);
        out.push(target);
    }
    return out;
}
/**
 * Stream the selected files as a single zip (no recompression). Used by the
 * HTTP API so a browser gets one ready-to-use bundle.
 */
export function zipStream(http, files, folder) {
    const items = expandFiles(files);
    const prefix = safeRelative(folder);
    return new ReadableStream({
        async start(controller) {
            const zip = new Zip((err, chunk, final) => {
                if (err)
                    return controller.error(err);
                controller.enqueue(chunk);
                if (final)
                    controller.close();
            });
            try {
                for (const item of items) {
                    assertPublicUrl(item.url);
                    const res = await http.raw(item.url, { headers: { accept: "*/*" } });
                    const entry = new ZipPassThrough(`${prefix}/${item.path}`);
                    zip.add(entry);
                    const reader = res.body.getReader();
                    for (;;) {
                        const { done, value } = await reader.read();
                        if (done)
                            break;
                        entry.push(value);
                    }
                    entry.push(new Uint8Array(0), true);
                }
                zip.end();
            }
            catch (e) {
                zip.terminate();
                controller.error(e);
            }
        },
    });
}
async function exists(p) {
    try {
        await stat(p);
        return true;
    }
    catch {
        return false;
    }
}
export function formatBytes(n) {
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    while (n >= 1024 && i < units.length - 1) {
        n /= 1024;
        i++;
    }
    return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}
/** Folder name for an asset: `<provider>-<slug>`. */
export function assetFolderName(asset) {
    const slug = basename(asset.nativeId.replace(/\\/g, "/")).replace(/[^\w.-]+/g, "_").slice(0, 80) || "asset";
    return `${asset.provider}-${slug}`;
}
//# sourceMappingURL=download.js.map