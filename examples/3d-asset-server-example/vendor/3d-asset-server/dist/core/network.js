/**
 * Where a caller runs, as one bounded label: an AI vendor's cloud, a public
 * cloud, an ISP (home, office or mobile), a private address, or unknown.
 *
 * - Anthropic and OpenAI publish the address ranges their agents and
 *   connectors call out from; those match exactly.
 * - Everything else is looked up in MaxMind's GeoLite2-ASN database (which
 *   network owns the address) and sorted into cloud or ISP.
 *
 * The address is only looked up, never stored or logged.
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { BlockList, isIP } from "node:net";
import { gunzipSync } from "node:zlib";
import { Reader } from "mmdb-lib";
/**
 * Anthropic's outbound range (MCP connector calls, web fetch) plus its own
 * IPv6 allocation: https://docs.claude.com/en/api/ip-addresses
 */
export const ANTHROPIC_RANGES = ["160.79.104.0/21", "2607:6bc0::/48"];
/** OpenAI's published egress lists for ChatGPT connectors and user-initiated actions. */
export const OPENAI_RANGE_URLS = ["https://openai.com/chatgpt-connectors.json", "https://openai.com/chatgpt-user.json"];
const PRIVATE_RANGES = [
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "127.0.0.0/8",
    "100.64.0.0/10",
    "169.254.0.0/16",
    "::1/128",
    "fc00::/7",
    "fe80::/10",
];
/** Autonomous systems of the big clouds. */
const CLOUD_ASNS = {
    16509: "aws", 14618: "aws", 8987: "aws", 7224: "aws",
    15169: "gcp", 396982: "gcp", 19527: "gcp", 36492: "gcp", 139070: "gcp",
    8075: "azure", 8068: "azure", 8069: "azure", 12076: "azure",
};
/** Other hosting and cloud providers, by ASN. */
const HOSTING_ASNS = new Set([
    14061, // DigitalOcean
    24940, 213230, 212317, // Hetzner
    16276, // OVH
    63949, 20940, 35994, // Linode / Akamai
    31898, // Oracle Cloud
    20473, // Vultr (Choopa)
    45102, 37963, // Alibaba
    132203, 45090, // Tencent
    12876, // Scaleway
    51167, // Contabo
    13335, // Cloudflare (Workers and WARP egress)
    54113, // Fastly
    40509, // Fly.io
    36351, // IBM / SoftLayer
    60781, 16265, 28753, // Leaseweb
    9009, // M247
    62567, 46562, // more DigitalOcean / Performive
    8100, // QuadraNet
    29802, // HIVELOCITY
    53667, // FranTech / BuyVM
    35540, // OVH (Canada)
    197540, // netcup
    47583, // Hostinger
    8560, // IONOS
    202053, // UpCloud
    396356, // Latitude.sh
    19318, // Interserver
]);
/** Hosting-sounding network names, for providers not in the lists above. */
const HOSTING_NAME = /\b(hosting|cloud|datacenter|data center|vps|server|colo(cation)?|dedicated)\b/i;
/** Strip the IPv4-in-IPv6 prefix Node reports for dual-stack sockets. */
export function normalizeIp(ip) {
    if (!ip)
        return undefined;
    const v = ip.trim().replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, "");
    return isIP(v) ? v : undefined;
}
function blockList(cidrs) {
    const list = new BlockList();
    for (const cidr of cidrs) {
        const [net, bits] = cidr.split("/");
        const type = isIP(net ?? "") === 6 ? "ipv6" : "ipv4";
        if (!net || !bits || !isIP(net))
            continue;
        try {
            list.addSubnet(net, Number(bits), type);
        }
        catch {
            // Ignore malformed entries in published lists.
        }
    }
    return list;
}
function has(list, ip) {
    return list.check(ip, isIP(ip) === 6 ? "ipv6" : "ipv4");
}
export class NetworkClassifier {
    anthropic = blockList(ANTHROPIC_RANGES);
    privateRanges = blockList(PRIVATE_RANGES);
    openai = blockList([]);
    asn;
    /** When the loaded ASN database was built (unix seconds), 0 without one. */
    asnBuiltAt = 0;
    /** Number of OpenAI ranges loaded. */
    openaiRanges = 0;
    constructor(opts = {}) {
        this.asn = opts.asn;
        if (opts.openaiRanges)
            this.setOpenAiRanges(opts.openaiRanges);
    }
    setAsn(asn, builtAt = 0) {
        this.asn = asn;
        this.asnBuiltAt = builtAt;
    }
    setOpenAiRanges(cidrs) {
        this.openai = blockList(cidrs);
        this.openaiRanges = cidrs.length;
    }
    classify(rawIp) {
        const ip = normalizeIp(rawIp);
        if (!ip)
            return "unknown";
        if (has(this.privateRanges, ip))
            return "private";
        if (has(this.anthropic, ip))
            return "anthropic";
        if (has(this.openai, ip))
            return "openai";
        if (!this.asn)
            return "unknown";
        let rec = null;
        try {
            rec = this.asn.get(ip);
        }
        catch {
            return "unknown";
        }
        const num = rec?.autonomous_system_number;
        if (!num)
            return "unknown";
        const big = CLOUD_ASNS[num];
        if (big)
            return big;
        if (HOSTING_ASNS.has(num) || HOSTING_NAME.test(rec?.autonomous_system_organization ?? ""))
            return "cloud";
        return "isp";
    }
}
/** Parse OpenAI's `{"prefixes":[{"ipv4Prefix": "..."}, {"ipv6Prefix": "..."}]}` lists. */
export function parsePrefixList(json) {
    const prefixes = json?.prefixes;
    if (!Array.isArray(prefixes))
        return [];
    const out = [];
    for (const p of prefixes) {
        const v = p?.ipv4Prefix ?? p?.ipv6Prefix;
        if (typeof v === "string")
            out.push(v);
    }
    return out;
}
/** The first `.mmdb` file inside a (ustar) tar archive. */
export function mmdbFromTar(tar) {
    const text = (from, len) => Buffer.from(tar.subarray(from, from + len)).toString("utf8").replace(/\0.*$/s, "");
    let off = 0;
    while (off + 512 <= tar.length) {
        const name = text(off, 100);
        if (!name)
            break;
        const size = parseInt(text(off + 124, 12).trim() || "0", 8);
        const prefix = text(off + 345, 155);
        const full = prefix ? `${prefix}/${name}` : name;
        const start = off + 512;
        if (full.endsWith(".mmdb"))
            return Buffer.from(tar.subarray(start, start + size));
        off = start + Math.ceil(size / 512) * 512;
    }
    return undefined;
}
const WEEK_MS = 7 * 24 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;
const MAXMIND_URL = "https://download.maxmind.com/geoip/databases/GeoLite2-ASN/download?suffix=tar.gz";
function loadReader(buf) {
    const reader = new Reader(buf);
    return { reader, builtAt: Math.floor(reader.metadata.buildEpoch.getTime() / 1000) };
}
async function fresh(path, maxAgeMs) {
    try {
        return Date.now() - (await stat(path)).mtimeMs < maxAgeMs;
    }
    catch {
        return false;
    }
}
/** Load (or download) the ASN database once. Returns true when one is in use. */
export async function loadAsnDatabase(opts) {
    const log = opts.log ?? ((l) => console.error(l));
    const use = (buf, from) => {
        const { reader, builtAt } = loadReader(buf);
        opts.classifier.setAsn(reader, builtAt);
        log(`network labels: ASN database loaded from ${from} (built ${new Date(builtAt * 1000).toISOString().slice(0, 10)})`);
    };
    if (opts.asnDbPath) {
        use(await readFile(opts.asnDbPath), opts.asnDbPath);
        return true;
    }
    if (!opts.maxmindAccountId || !opts.maxmindLicenseKey)
        return false;
    const cache = join(opts.cacheDir ?? join(tmpdir(), "3d-asset-server"), "GeoLite2-ASN.mmdb");
    if (await fresh(cache, WEEK_MS)) {
        try {
            use(await readFile(cache), "cache");
            return true;
        }
        catch {
            // Corrupt cache: download again.
        }
    }
    const doFetch = opts.fetch ?? fetch;
    const auth = Buffer.from(`${opts.maxmindAccountId}:${opts.maxmindLicenseKey}`).toString("base64");
    const res = await doFetch(MAXMIND_URL, { headers: { authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(60_000) });
    if (!res.ok)
        throw new Error(`GeoLite2-ASN download failed: HTTP ${res.status}`);
    const mmdb = mmdbFromTar(gunzipSync(Buffer.from(await res.arrayBuffer())));
    if (!mmdb)
        throw new Error("GeoLite2-ASN download had no .mmdb file");
    use(mmdb, "MaxMind");
    try {
        await mkdir(dirname(cache), { recursive: true });
        await writeFile(cache, mmdb);
    }
    catch {
        // Read-only disk: keep it in memory only.
    }
    return true;
}
/** Fetch OpenAI's published egress ranges. Returns how many were loaded. */
export async function loadOpenAiRanges(opts) {
    const doFetch = opts.fetch ?? fetch;
    const all = [];
    for (const url of OPENAI_RANGE_URLS) {
        const res = await doFetch(url, { signal: AbortSignal.timeout(20_000) });
        if (!res.ok)
            throw new Error(`${url}: HTTP ${res.status}`);
        all.push(...parsePrefixList(await res.json()));
    }
    if (all.length)
        opts.classifier.setOpenAiRanges([...new Set(all)]);
    return all.length;
}
/**
 * Load the network data now and keep it fresh in the background (OpenAI's
 * ranges daily, the ASN database weekly). Failures are logged and retried at
 * the next refresh; labels fall back to `unknown` until data arrives.
 */
export function startNetworkData(opts) {
    const log = opts.log ?? ((l) => console.error(l));
    const run = (what, job) => job().catch((e) => log(`network labels: ${what} failed: ${e instanceof Error ? e.message : String(e)}`));
    const openai = () => run("OpenAI ranges", () => loadOpenAiRanges(opts));
    const asn = () => run("ASN database", () => loadAsnDatabase(opts));
    void openai();
    void asn();
    const timers = [setInterval(openai, DAY_MS), setInterval(asn, WEEK_MS + 3600_000)];
    for (const t of timers)
        t.unref();
    return () => timers.forEach(clearInterval);
}
//# sourceMappingURL=network.js.map