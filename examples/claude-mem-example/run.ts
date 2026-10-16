/*
 * Studio Yebisu — Claude-Mem fixed-source progressive memory search example.
 * Copyright (c) 2026 Studio Yebisu. MIT License.
 *
 * Runs the unmodified Claude-Mem 13.39.0 worker classes (DatabaseManager, saveMemory,
 * SearchManager, ProgressiveMemorySearch, progressiveSearchToolResult) from vendor/claude-mem
 * on five fictional notes, with Bun and local SQLite FTS5 only.
 *
 *   bun --no-install run.ts --artifact-dir <new empty folder outside this site>
 *
 * The private artifact folder receives settings.json, the SQLite database, upstream logs and
 * the worker's job/result files. The only public write is outputs/memory-run.json, created
 * once, after every check has passed. Nothing is downloaded, no server, watcher, Chroma,
 * cloud sync, SDK/Claude process or model call is started, and no existing file is replaced.
 *
 * Internal worker mode (launched once by the parent run, same file):
 *   bun --no-install run.ts --worker --artifact-dir <private dir> --worker-input <job JSON>
 */
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import {
  existsSync, linkSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync,
  renameSync, statSync, unlinkSync, writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import os from "node:os";

const SITE = import.meta.dir;
const RUN_PATH = import.meta.path;
const VENDOR = join(SITE, "vendor", "claude-mem");
const DEFAULT_OUT = join(SITE, "outputs", "memory-run.json");

const FORMAT = "studio-yebisu-claude-mem-run-v1";
const WORKER_JOB_FORMAT = "studio-yebisu-claude-mem-worker-job-v1";
const WORKER_RESULT_FORMAT = "studio-yebisu-claude-mem-worker-result-v1";
const PIN = {
  repository: "thedotmack/claude-mem",
  commit: "fef3402e674bebbf72a23aeb735e91c92cd34afd",
  version: "13.39.0",
  license: "Apache-2.0",
  notice: "Copyright 2026 Alex Newman",
  lockSha256: "d0f19c3060cc9d95443974a6916b07880b7f6e6fda9ae1c32888f582edbe5a89",
  files: 194,
};
const INPUT_SHA256: Record<string, string> = {
  "input/notes.json": "615600356841c0f3a7d8bf55773f2a6869da320a9c03ae2c9552df15be38e5f3",
  "input/scenarios.json": "29f4d0ad731aae355a160a6896c799af502236221f7bff2736038f5a044fd3fd",
};
const BUN_VERSION = "1.4.3";
const SAMPLE_IDS = ["C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08"];
const EXECUTION_ORDER = ["C01", "C02", "C03", "C04", "C05", "C06", "C08", "C07"];
const CURSOR = /^ms_[A-Za-z0-9_-]{24}$/;

// Private settings.json for this run. These are the real keys read by the fixed source:
// Chroma, cloud sync (all three empty = off), Grok Bot awareness and index/inject writer,
// near-duplicate merging, and worker autostart. Telemetry has no settings.json key in
// 13.39.0; it is switched off through DO_NOT_TRACK / CLAUDE_MEM_TELEMETRY below.
const SETTINGS: Record<string, string> = {
  CLAUDE_MEM_CHROMA_ENABLED: "false",
  CLAUDE_MEM_CLOUD_SYNC_TOKEN: "",
  CLAUDE_MEM_CLOUD_SYNC_USER_ID: "",
  CLAUDE_MEM_CLOUD_SYNC_HUB_URL: "",
  CLAUDE_MEM_CLOUD_SYNC_WS: "false",
  CLAUDE_MEM_GROK_BOT_AWARENESS_ENABLED: "false",
  CLAUDE_MEM_GROK_BOT_INJECT_ENABLED: "false",
  CLAUDE_MEM_DEDUP_ENABLED: "false",
  CLAUDE_MEM_WORKER_AUTOSTART: "false",
};
const TELEMETRY_ENV: Record<string, string> = {
  DO_NOT_TRACK: "1",
  CLAUDE_MEM_TELEMETRY: "false",
  CLAUDE_MEM_TELEMETRY_ERRORS: "false",
};
const CREDENTIAL_LIKE = /(API_?KEY|AUTH_?TOKEN|ACCESS_?TOKEN|OAUTH|SECRET|PASSWORD|CREDENTIAL|ANTHROPIC|OPENAI|OPENROUTER|GEMINI|GOOGLE_API|CLAUDE_CODE)/i;
// System variables passed to the worker (matched case-insensitively, as Windows does).
const WORKER_ENV_ALLOWLIST = new Set([
  "PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "TMPDIR",
  "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE", "TZ", "LANG",
]);
// Exact number of check() calls per sample; C07 includes the fresh worker's own checks.
const EXPECTED_CHECKS: Record<string, number> = {
  C01: 7, C02: 17, C03: 8, C04: 9, C05: 9, C06: 14, C07: 24, C08: 11,
};
const WORKER_EXPECTED_CHECKS = 16;

// --- Guards: installed before any upstream module is imported -------------------------------

type GuardKind = "network" | "server" | "process";
const requireBuiltin = createRequire(import.meta.url);
const GUARD = {
  installed: [] as { api: string; kind: GuardKind; present: boolean; installed: boolean; required: boolean }[],
  attempts: {} as Record<string, number>,
  kinds: {} as Record<string, GuardKind>,
  ownWorkerSpawns: 0,
  esmNamedExports: {} as Record<string, boolean>,
  syncBuiltinESMExports: false,
};
const REAL_SPAWN_SYNC: ((cmd: string[], options: Record<string, unknown>) => any) | null =
  typeof Bun?.spawnSync === "function" ? Bun.spawnSync.bind(Bun) : null;

function blocked(kind: GuardKind, api: string) {
  return function guardBlocked() {
    GUARD.attempts[api] = (GUARD.attempts[api] ?? 0) + 1;
    throw new Error(`Blocked by run.ts ${kind} guard: ${api}`);
  };
}

function patch(target: any, key: string, api: string, kind: GuardKind, required: boolean) {
  const present = target != null && typeof target[key] === "function";
  let installed = false;
  if (present) {
    const replacement = blocked(kind, api);
    try {
      Object.defineProperty(target, key, { value: replacement, configurable: true, writable: true, enumerable: true });
    } catch {
      try { target[key] = replacement; } catch { /* recorded as not installed */ }
    }
    installed = target[key] === replacement;
  }
  GUARD.kinds[api] = kind;
  GUARD.installed.push({ api, kind, present, installed, required });
}

function installGuards() {
  const http = requireBuiltin("node:http");
  const https = requireBuiltin("node:https");
  const http2 = requireBuiltin("node:http2");
  const net = requireBuiltin("node:net");
  const tls = requireBuiltin("node:tls");
  const dns = requireBuiltin("node:dns");
  const childProcess = requireBuiltin("node:child_process");

  patch(globalThis, "fetch", "globalThis.fetch", "network", true);
  patch(globalThis, "WebSocket", "globalThis.WebSocket", "network", false);
  patch(Bun, "fetch", "Bun.fetch", "network", false);
  patch(Bun, "connect", "Bun.connect", "network", false);
  patch(Bun, "udpSocket", "Bun.udpSocket", "network", false);
  patch((Bun as any).dns, "lookup", "Bun.dns.lookup", "network", false);
  patch(Bun, "listen", "Bun.listen", "server", false);
  patch(Bun, "serve", "Bun.serve", "server", false);
  for (const [module, name] of [[http, "http"], [https, "https"]] as const) {
    patch(module, "request", `node:${name}.request`, "network", true);
    patch(module, "get", `node:${name}.get`, "network", true);
    patch(module, "createServer", `node:${name}.createServer`, "server", false);
  }
  patch(http2, "connect", "node:http2.connect", "network", false);
  patch(net, "connect", "node:net.connect", "network", true);
  patch(net, "createConnection", "node:net.createConnection", "network", true);
  patch(net.Socket?.prototype, "connect", "node:net.Socket.prototype.connect", "network", true);
  patch(net, "createServer", "node:net.createServer", "server", false);
  patch(net.Server?.prototype, "listen", "node:net.Server.prototype.listen", "server", false);
  patch(tls, "connect", "node:tls.connect", "network", true);
  for (const key of ["lookup", "lookupService", "resolve", "resolve4", "resolve6", "resolveAny", "resolveCname", "resolveMx", "resolveNs", "resolveSrv", "resolveTxt", "reverse"]) {
    patch(dns, key, `node:dns.${key}`, "network", key === "lookup");
  }
  for (const key of ["lookup", "resolve", "resolve4", "resolve6", "resolveAny"]) {
    patch(dns.promises, key, `node:dns.promises.${key}`, "network", key === "lookup");
  }
  for (const key of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]) {
    patch(childProcess, key, `node:child_process.${key}`, "process", true);
  }
  patch(Bun, "spawn", "Bun.spawn", "process", false);
  patch(Bun, "spawnSync", "Bun.spawnSync", "process", false);
  try {
    const moduleApi = requireBuiltin("node:module");
    if (typeof moduleApi.syncBuiltinESMExports === "function") {
      moduleApi.syncBuiltinESMExports();
      GUARD.syncBuiltinESMExports = true;
    }
  } catch { /* recorded as false */ }
  const missing = GUARD.installed.filter(item => item.required && !item.installed).map(item => item.api);
  if (missing.length) throw new Error(`Required guards could not be installed: ${missing.join(", ")}`);
}

async function recordEsmBindings() {
  // Whether `import { request } from "node:http"` style bindings see the patched functions.
  for (const [module, key] of [["node:http", "request"], ["node:https", "request"], ["node:net", "connect"], ["node:tls", "connect"], ["node:dns", "lookup"], ["node:child_process", "spawn"]]) {
    const namespace: any = await import(module);
    GUARD.esmNamedExports[`${module}#${key}`] = namespace[key] === requireBuiltin(module)[key];
  }
}

function guardSummary() {
  const byKind: Record<GuardKind, number> = { network: 0, server: 0, process: 0 };
  for (const [api, count] of Object.entries(GUARD.attempts)) byKind[GUARD.kinds[api] ?? "network"] += count;
  return {
    scope: "JavaScript APIs replaced by run.ts before upstream imports; not whole-system isolation.",
    installed: GUARD.installed.map(item => ({ ...item })),
    sync_builtin_esm_exports_called: GUARD.syncBuiltinESMExports,
    esm_named_exports_follow_patch: { ...GUARD.esmNamedExports },
    attempts: { ...GUARD.attempts },
    attempts_by_kind: byKind,
    total_attempts: byKind.network + byKind.server + byKind.process,
    own_worker_spawns: GUARD.ownWorkerSpawns,
  };
}

installGuards();

// --- Small helpers -----------------------------------------------------------------------------

function fail(message: string): never {
  throw new Error(message);
}

function sha256(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function gitBlobSha1(data: Uint8Array): string {
  return createHash("sha1").update(`blob ${data.length}\0`).update(data).digest("hex");
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Real path of an existing path, or of its nearest existing ancestor plus the remainder. */
function realish(path: string): string {
  const absolute = resolve(path);
  if (existsSync(absolute)) return realpathSync.native(absolute);
  const parent = dirname(absolute);
  if (parent === absolute) return absolute;
  return join(realish(parent), basename(absolute));
}

function comparable(path: string): string {
  const real = realish(path);
  return process.platform === "win32" ? real.toLowerCase() : real;
}

function isInside(child: string, parent: string): boolean {
  const rel = relative(comparable(parent), comparable(child));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function sameSet(a: string[], b: string[]): boolean {
  const left = new Set(a);
  return left.size === a.length && left.size === new Set(b).size && b.every(item => left.has(item));
}

function toolText(toolResult: any): string {
  return String(toolResult?.content?.[0]?.text ?? "");
}

function parseArgs(argv: string[]) {
  const args = { worker: false, artifactDir: null as string | null, workerInput: null as string | null, out: null as string | null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = () => argv[++i] ?? fail(`${arg} needs a value.`);
    if (arg === "--worker") args.worker = true;
    else if (arg === "--artifact-dir") args.artifactDir = value();
    else if (arg === "--worker-input") args.workerInput = value();
    else if (arg === "--out") args.out = value();
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: bun --no-install run.ts --artifact-dir <new empty folder outside this site> [--out <new JSON path>]");
      process.exit(0);
    } else fail(`Unknown argument: ${arg}`);
  }
  if (!args.artifactDir) fail("--artifact-dir <new empty folder outside this site> is required.");
  return args;
}

// --- Verification before the first write -------------------------------------------------------

function verifySource() {
  const lockBytes = readFileSync(join(SITE, "vendor-lock.json"));
  const lockSha = sha256(lockBytes);
  if (lockSha !== PIN.lockSha256) fail("vendor-lock.json does not match the pinned SHA-256.");
  const lock = JSON.parse(lockBytes.toString("utf8"));
  if (lock.repository !== PIN.repository || lock.commit !== PIN.commit || lock.version !== PIN.version || lock.license !== PIN.license) {
    fail("vendor-lock.json repository, commit, version or license differs from the pin.");
  }
  if (lock.tree_truncated !== false || !Array.isArray(lock.files) || lock.files.length !== PIN.files) {
    fail(`vendor-lock.json must list exactly ${PIN.files} files.`);
  }
  const paths = new Set<string>();
  let bytes = 0;
  for (const file of lock.files) {
    const path = String(file.path);
    if (!/^[A-Za-z0-9._@-][A-Za-z0-9._@/-]*$/.test(path) || path.split("/").some(part => part === ".." || part === "") || paths.has(path)) {
      fail(`Unsafe or repeated vendor path: ${path}`);
    }
    const absolute = join(VENDOR, ...path.split("/"));
    if (!isInside(absolute, VENDOR)) fail(`Vendor path escapes vendor/claude-mem: ${path}`);
    const stat = lstatSync(absolute);
    if (!stat.isFile()) fail(`Vendor path is not a regular file: ${path}`);
    const data = readFileSync(absolute);
    if (data.length !== file.bytes || sha256(data) !== file.sha256 || gitBlobSha1(data) !== file.git_blob_sha1) {
      fail(`Vendor file differs from the lock: ${path}`);
    }
    paths.add(path);
    bytes += data.length;
  }
  const upstreamPackage = readJson(join(VENDOR, "package.json"));
  if (upstreamPackage.name !== "claude-mem" || upstreamPackage.version !== PIN.version) {
    fail("vendor/claude-mem/package.json is not claude-mem 13.39.0.");
  }
  return { lockSha, paths, bytes };
}

function verifyInputs() {
  const sha: Record<string, string> = {};
  const parsed: Record<string, any> = {};
  for (const [name, expected] of Object.entries(INPUT_SHA256)) {
    const data = readFileSync(join(SITE, ...name.split("/")));
    sha[name] = sha256(data);
    if (sha[name] !== expected) fail(`${name} differs from its frozen SHA-256.`);
    parsed[name] = JSON.parse(data.toString("utf8"));
  }
  const notesFile = parsed["input/notes.json"];
  const scenariosFile = parsed["input/scenarios.json"];
  if (notesFile.format !== "studio-yebisu-claude-mem-notes-v1" || notesFile.fictional !== true || !Array.isArray(notesFile.notes)) {
    fail("input/notes.json has an unexpected shape.");
  }
  const notes = notesFile.notes as { key: string; project: string; title: string; text: string }[];
  if (notes.map(note => note.key).join(",") !== "N01,N02,N03,N04,N05") fail("input/notes.json must hold N01–N05 in order.");
  for (const note of notes) {
    if (![note.project, note.title, note.text].every(value => typeof value === "string" && value.trim() === value && value.length > 0)) {
      fail(`${note.key} needs a project, title and text.`);
    }
  }
  if (scenariosFile.format !== "studio-yebisu-claude-mem-scenarios-v1" || !Array.isArray(scenariosFile.scenarios)) {
    fail("input/scenarios.json has an unexpected shape.");
  }
  const scenarios = scenariosFile.scenarios as any[];
  if (scenarios.map(item => item.id).join(",") !== SAMPLE_IDS.join(",")) fail("input/scenarios.json must hold C01–C08 in order.");
  return { sha, notes, scenarios };
}

function dependencyVersions() {
  const declared = readJson(join(SITE, "package.json")).dependencies as Record<string, string>;
  const installed: Record<string, string> = {};
  for (const [name, wanted] of Object.entries(declared)) {
    const manifest = join(SITE, "node_modules", ...name.split("/"), "package.json");
    if (!existsSync(manifest)) fail(`Dependency ${name} is not installed; run npm ci --ignore-scripts first.`);
    installed[name] = readJson(manifest).version;
    if (installed[name] !== wanted) fail(`Dependency ${name} is ${installed[name]}, expected ${wanted}.`);
  }
  return { declared, installed, package_lock_sha256: sha256(readFileSync(join(SITE, "package-lock.json"))) };
}

function checkRuntime() {
  if (Bun.version !== BUN_VERSION) fail(`Bun ${BUN_VERSION} is required; this is ${Bun.version}.`);
  return { bun: Bun.version, bun_revision: Bun.revision, platform: process.platform, arch: process.arch, os_type: os.type(), os_release: os.release() };
}

// --- Private environment and upstream modules --------------------------------------------------

function prepareEnvironment(dataDir: string) {
  let removed = 0;
  for (const key of Object.keys(process.env)) {
    if (CREDENTIAL_LIKE.test(key) && !(key in SETTINGS)) {
      delete process.env[key];
      removed += 1;
    }
  }
  process.env.CLAUDE_MEM_DATA_DIR = dataDir;
  process.env.CLAUDE_CONFIG_DIR = join(dataDir, "claude-config-unused");
  for (const [key, value] of Object.entries({ ...TELEMETRY_ENV, ...SETTINGS })) process.env[key] = value;
  return {
    removed_credential_like_variables: removed,
    overridden_variables: ["CLAUDE_MEM_DATA_DIR", "CLAUDE_CONFIG_DIR", ...Object.keys(TELEMETRY_ENV), ...Object.keys(SETTINGS)],
  };
}

const IMPORTS = {
  DatabaseManager: "src/services/worker/DatabaseManager.ts",
  SearchManager: "src/services/worker/SearchManager.ts",
  ProgressiveMemorySearch: "src/services/worker/ProgressiveMemorySearch.ts",
  FormattingService: "src/services/worker/FormattingService.ts",
  TimelineService: "src/services/worker/TimelineService.ts",
  saveMemory: "src/services/memory/save-memory.ts",
  progressiveSearch: "src/shared/progressive-search.ts",
  SettingsDefaultsManager: "src/shared/SettingsDefaultsManager.ts",
  paths: "src/shared/paths.ts",
  consent: "src/services/telemetry/consent.ts",
};

async function loadUpstream(lockedPaths: Set<string>) {
  for (const path of Object.values(IMPORTS)) if (!lockedPaths.has(path)) fail(`${path} is not in vendor-lock.json.`);
  const load = (path: string) => import(pathToFileURL(join(VENDOR, ...path.split("/"))).href);
  const paths = await load(IMPORTS.paths);
  const settings = await load(IMPORTS.SettingsDefaultsManager);
  const consent = await load(IMPORTS.consent);
  const { DatabaseManager } = await load(IMPORTS.DatabaseManager);
  const { SearchManager } = await load(IMPORTS.SearchManager);
  const { ProgressiveMemorySearch } = await load(IMPORTS.ProgressiveMemorySearch);
  const { FormattingService } = await load(IMPORTS.FormattingService);
  const { TimelineService } = await load(IMPORTS.TimelineService);
  const { saveMemory } = await load(IMPORTS.saveMemory);
  const progressive = await load(IMPORTS.progressiveSearch);
  return {
    paths, SettingsDefaultsManager: settings.SettingsDefaultsManager, consent,
    DatabaseManager, SearchManager, ProgressiveMemorySearch, FormattingService, TimelineService, saveMemory,
    progressiveSearchToolResult: progressive.progressiveSearchToolResult,
    progressiveSearchToolError: progressive.progressiveSearchToolError,
    ProgressiveSearchError: progressive.ProgressiveSearchError,
  };
}

type Upstream = Awaited<ReturnType<typeof loadUpstream>>;

/** Booleans only: the absolute locations stay private. */
function isolationReport(up: Upstream, dataDir: string) {
  const effective = up.SettingsDefaultsManager.loadFromFile(up.paths.USER_SETTINGS_PATH);
  const consent = up.consent.explainTelemetryConsent(process.env, up.consent.loadTelemetryConfig());
  return {
    data_dir_is_private_artifact: comparable(up.paths.DATA_DIR) === comparable(dataDir),
    database_inside_private_artifact: isInside(up.paths.DB_PATH, dataDir),
    settings_inside_private_artifact: isInside(up.paths.USER_SETTINGS_PATH, dataDir),
    effective_settings_match: Object.entries(SETTINGS).every(([key, value]) => effective[key] === value),
    telemetry: { enabled: consent.enabled, decided_by: consent.source, error_capture_enabled: up.consent.isErrorTelemetryEnabled(process.env) },
  };
}

function openSearch(up: Upstream, db: any) {
  const manager = new up.SearchManager(db.getSessionSearch(), db.getSessionStore(), db.getChromaSync(), new up.FormattingService(), new up.TimelineService());
  return new up.ProgressiveMemorySearch(manager, db.getSessionStore());
}

/** Real SQL, used only to audit storage; retrieval goes through ProgressiveMemorySearch. */
function sqlAudit(db: any) {
  const conn = db.getConnection();
  const count = (sql: string) => Number((conn.query(sql).get() as { n: number }).n);
  return {
    observations: count("SELECT COUNT(*) AS n FROM observations"),
    observations_by_project: Object.fromEntries((conn.query("SELECT project, COUNT(*) AS n FROM observations GROUP BY project ORDER BY project").all() as { project: string; n: number }[]).map(row => [row.project, Number(row.n)])),
    session_summaries: count("SELECT COUNT(*) AS n FROM session_summaries"),
    user_prompts: count("SELECT COUNT(*) AS n FROM user_prompts"),
    sdk_sessions: count("SELECT COUNT(*) AS n FROM sdk_sessions"),
  };
}

function observationRows(db: any) {
  return db.getConnection().query("SELECT id, project, type, title, subtitle, narrative, metadata, discovery_tokens FROM observations ORDER BY id").all() as any[];
}

async function capture(up: Upstream, mem: any, args: Record<string, unknown>) {
  const result = await mem.run(clone(args));
  return { result: clone(result), tool_result: clone(up.progressiveSearchToolResult(result)) };
}

async function captureError(up: Upstream, mem: any, args: Record<string, unknown>) {
  try {
    await mem.run(clone(args));
  } catch (error: any) {
    return {
      error: {
        name: String(error?.name), code: typeof error?.code === "string" ? error.code : null, message: String(error?.message ?? error),
        is_progressive_search_error: error instanceof up.ProgressiveSearchError,
      },
      tool_error: clone(up.progressiveSearchToolError(error)),
    };
  }
  fail(`mem_search accepted ${JSON.stringify(args).slice(0, 80)} without throwing.`);
}

function firstAsciiWord(title: string): string {
  return title.match(/[A-Za-z][A-Za-z0-9]*/)?.[0] ?? fail(`No ASCII keyword in title: ${title}`);
}

function modifyCursor(token: string): string {
  return token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
}

// --- Sample records ----------------------------------------------------------------------------

type Sample = { id: string; label: string; input: any; output: any; summary: string; checks: { name: string; passed: true }[] };

function newSample(scenarios: any[], id: string): Sample {
  const scenario = scenarios.find(item => item.id === id) ?? fail(`Missing scenario ${id}`);
  return { id, label: scenario.label, input: { scenario: clone(scenario), calls: [] }, output: { calls: [] }, summary: "", checks: [] };
}

function check(sample: Sample, name: string, condition: unknown) {
  if (!condition) fail(`${sample.id} check failed: ${name}`);
  sample.checks.push({ name, passed: true });
}

function addCall(sample: Sample, name: string, fn: string, args: unknown) {
  sample.input.calls.push({ name, fn, args: clone(args) });
}

function addOutput(sample: Sample, name: string, payload: Record<string, unknown>) {
  sample.output.calls.push({ name, ...payload });
}

// --- Parent run --------------------------------------------------------------------------------

async function parent(args: ReturnType<typeof parseArgs>) {
  const artifact = resolve(args.artifactDir!);
  if (isInside(artifact, SITE) || isInside(SITE, artifact)) fail("--artifact-dir must be outside the served site folder.");
  if (existsSync(artifact) && (!statSync(artifact).isDirectory() || readdirSync(artifact).length > 0)) {
    fail("--artifact-dir must be a new or empty folder; existing files are never deleted or reused.");
  }
  const outPath = resolve(args.out ?? DEFAULT_OUT);
  if (existsSync(outPath)) fail("The output JSON already exists; it is never overwritten. Use a copied work folder or --out <new path>.");
  if (isInside(outPath, artifact) || isInside(outPath, VENDOR) || isInside(outPath, join(SITE, "input"))) fail("--out must not be inside the artifact, vendor or input folders.");
  if (!existsSync(dirname(outPath))) fail("The output folder must already exist.");

  // Everything below up to mkdir is read-only verification.
  const source = verifySource();
  const inputs = verifyInputs();
  const runtime = checkRuntime();
  const dependencies = dependencyVersions();
  if (!REAL_SPAWN_SYNC) fail("Bun.spawnSync is unavailable; the fresh worker cannot be started.");
  console.log(`Verified ${source.paths.size} vendor files, vendor-lock.json and 2 frozen inputs.`);

  mkdirSync(artifact, { recursive: true });
  const dataDir = join(artifact, "data");
  mkdirSync(dataDir);
  writeFileSync(join(dataDir, "settings.json"), JSON.stringify(SETTINGS, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  const environment = prepareEnvironment(dataDir);
  await recordEsmBindings();
  const up = await loadUpstream(source.paths);
  const isolation = isolationReport(up, dataDir);

  const { notes, scenarios } = inputs;
  const note = Object.fromEntries(notes.map(item => [item.key, item]));
  const allTexts = notes.map(item => item.text);
  const noProse = (text: string) => allTexts.every(prose => !text.includes(prose));
  const samples: Record<string, Sample> = {};
  for (const id of SAMPLE_IDS) samples[id] = newSample(scenarios, id);

  const db = new up.DatabaseManager();
  await db.initialize();
  const mem = openSearch(up, db);
  const services = { chroma_sync: db.getChromaSync() === null ? "null (disabled)" : "present", cloud_sync: db.getCloudSync() === null ? "null (not configured)" : "present" };
  if (services.chroma_sync !== "null (disabled)" || services.cloud_sync !== "null (not configured)") fail("Chroma or cloud sync was activated.");
  if (!Object.values(isolation).every(value => typeof value !== "boolean" || value) || isolation.telemetry.enabled || isolation.telemetry.error_capture_enabled) {
    fail("Private storage or telemetry isolation did not hold.");
  }

  // C01 — empty index before any save.
  {
    const s = samples.C01;
    const sc = s.input.scenario;
    const before = sqlAudit(db);
    s.output.sql_audit_before = before;
    check(s, "observations table is empty before the first search", before.observations === 0 && before.session_summaries === 0 && before.user_prompts === 0);
    const callArgs = { query: sc.query, project: sc.project, mode: sc.mode, limit: sc.limit };
    addCall(s, "empty_search", "ProgressiveMemorySearch.run", callArgs);
    const r = await capture(up, mem, callArgs);
    addOutput(s, "empty_search", r);
    check(s, "guided step 1 result", r.result.step === 1 && r.result.mode === "guided");
    check(s, "complete with reason no_results", r.result.complete === true && r.result.reason === "no_results");
    check(s, "empty index", r.result.index.length === 0);
    check(s, "no observations", r.result.observations.length === 0);
    check(s, "no continuation for an empty index", r.result.continuation === null && r.result.next === null);
    check(s, "tool text reports no matching memories", toolText(r.tool_result).includes("No matching memories found."));
    s.summary = `保存前に「${sc.query}」を ${sc.project} で探すと、索引は${r.result.index.length}件、本文も0件でした（reason: ${r.result.reason}）。`;
  }
  console.log("C01 ok");

  // C02 — related search before each explicit save, then an exact replay.
  const ids: Record<string, number> = {};
  {
    const s = samples.C02;
    const sc = s.input.scenario;
    if (sc.replay_key !== "N01" || sc.expected_notes !== notes.length || sc.search_before_every_note !== true) fail("C02 scenario differs from what run.ts executes.");
    for (const item of notes) {
      const searchArgs = { query: firstAsciiWord(item.title), project: item.project, mode: "guided", limit: 6 };
      addCall(s, `related_search:${item.key}`, "ProgressiveMemorySearch.run", searchArgs);
      const r = await capture(up, mem, searchArgs);
      addOutput(s, `related_search:${item.key}`, r);
      const expected = item.key === "N02" ? [String(ids.N01)] : [];
      check(s, `${item.key}: related search ran first and returned only earlier same-project notes`,
        r.result.step === 1 && sameSet(r.result.index.map((row: any) => row.id), expected) && r.result.index.every((row: any) => row.project === item.project) && r.result.observations.length === 0);
      const saveInput = {
        text: item.text, title: item.title, project: item.project,
        metadata: { sourceFingerprint: `studio-yebisu-claude-mem-${item.key}-v1`, fixture_key: item.key },
      };
      addCall(s, `save:${item.key}`, "saveMemory", { defaultProject: item.project, input: saveInput });
      const saved = clone(up.saveMemory(db, item.project, clone(saveInput)));
      addOutput(s, `save:${item.key}`, { result: saved });
      check(s, `${item.key}: saved as a new observation`,
        saved.success === true && saved.duplicate === undefined && Number.isSafeInteger(saved.id) && saved.title === item.title && saved.project === item.project);
      ids[item.key] = saved.id;
    }
    check(s, "five distinct observation IDs", new Set(Object.values(ids)).size === 5);
    const n01 = note.N01;
    const replayInput = {
      text: n01.text, title: n01.title, project: n01.project,
      metadata: { sourceFingerprint: `studio-yebisu-claude-mem-${n01.key}-v1`, fixture_key: n01.key },
    };
    addCall(s, "replay:N01", "saveMemory", { defaultProject: n01.project, input: replayInput });
    const replay = clone(up.saveMemory(db, n01.project, clone(replayInput)));
    addOutput(s, "replay:N01", { result: replay });
    check(s, "replay of N01 is duplicate with the same ID", replay.success === true && replay.duplicate === true && replay.id === ids.N01);
    const audit = sqlAudit(db);
    const rows = observationRows(db);
    s.output.sql_audit_after = audit;
    s.output.sql_audit_rows = rows.map(row => ({
      id: row.id, project: row.project, type: row.type, title: row.title, subtitle: row.subtitle,
      narrative_matches_input: row.narrative === note[JSON.parse(row.metadata).fixture_key]?.text,
      metadata: JSON.parse(row.metadata), discovery_tokens: row.discovery_tokens,
    }));
    s.output.sql_audit_note = "SQL above is an audit of the private database only; every retrieval in this run goes through ProgressiveMemorySearch.run.";
    check(s, "total observations stays 5 after the replay", audit.observations === 5);
    check(s, "projects hold 3 + 2 observations", audit.observations_by_project["sakura-site"] === 3 && audit.observations_by_project["tsubaki-docs"] === 2 && Object.keys(audit.observations_by_project).length === 2);
    check(s, "stored rows equal the five input notes", rows.length === 5 && notes.every(item => rows.some(row =>
      row.id === ids[item.key] && row.project === item.project && row.title === item.title && row.narrative === item.text
      && JSON.parse(row.metadata).sourceFingerprint === `studio-yebisu-claude-mem-${item.key}-v1`)));
    check(s, "explicit manual notes only: no summaries, prompts or discovery tokens", audit.session_summaries === 0 && audit.user_prompts === 0 && rows.every(row => row.subtitle === "Manual memory" && Number(row.discovery_tokens) === 0));
    check(s, "one upstream manual session per project", audit.sdk_sessions === 2);
    s.summary = `5件を入力順に保存しました（sakura-site 3件・tsubaki-docs 2件）。保存の前には毎回関連検索を行い、N02の前にはN01「${n01.title}」が見つかりました。N01の同じ依頼を再送すると duplicate: true・同じID ${replay.id} が返り、総数は${audit.observations}件のままです。`;
  }
  console.log("C02 ok");

  // C03 — guided index (titles only). Options for later steps are fixed here.
  let c03: any;
  {
    const s = samples.C03;
    const sc = s.input.scenario;
    const c04 = scenarios.find(item => item.id === "C04");
    const callArgs = { query: sc.query, project: sc.project, mode: sc.mode, limit: sc.limit, maxDetails: 3, depthBefore: c04.depthBefore, depthAfter: c04.depthAfter };
    addCall(s, "index", "ProgressiveMemorySearch.run", callArgs);
    s.input.options_note = "maxDetails, depthBefore and depthAfter are set at the index call; continuations keep these options unchanged.";
    c03 = await capture(up, mem, callArgs);
    addOutput(s, "index", c03);
    const indexIds = c03.result.index.map((row: any) => row.id);
    check(s, "guided step 1, not complete", c03.result.step === 1 && c03.result.complete === false && c03.result.reason === null);
    check(s, "index is exactly N01 and N02", sameSet(indexIds, [String(ids.N01), String(ids.N02)]));
    check(s, "every row is a sakura-site observation", c03.result.index.every((row: any) => row.project === "sakura-site" && row.kind === "observation"));
    check(s, "foreign N04 is absent", !indexIds.includes(String(ids.N04)));
    check(s, "no full observations at the index step", c03.result.observations.length === 0);
    check(s, "opaque ms_ continuation", CURSOR.test(c03.result.continuation ?? ""));
    check(s, "tool text carries Continue with: and the cursor", toolText(c03.tool_result).includes(`Continue with: ${c03.result.continuation}`));
    check(s, "tool text contains no note prose", noProse(toolText(c03.tool_result)));
    s.summary = `索引だけが返りました。題名${indexIds.length}件（${c03.result.index.map((row: any) => `「${row.title}」`).join("")}）と、次の段階へ進む合図です。本文は0件、tsubaki-docs の記録は含まれていません。`;
  }
  console.log("C03 ok");

  // C04 — nearby context around the chosen N01.
  let c04: any;
  {
    const s = samples.C04;
    const callArgs = { continuation: c03.result.continuation, selectedIds: [String(ids.N01)], mode: "guided" };
    addCall(s, "context", "ProgressiveMemorySearch.run", callArgs);
    c04 = await capture(up, mem, callArgs);
    addOutput(s, "context", c04);
    const rows = c04.result.index;
    const anchor = rows.findIndex((row: any) => row.id === String(ids.N01));
    check(s, "guided step 2", c04.result.step === 2 && c04.result.complete === false);
    check(s, "selected N01 is present", anchor >= 0);
    check(s, "every context row is sakura-site", rows.every((row: any) => row.project === "sakura-site"));
    check(s, "at most one neighbour on each side", anchor <= 1 && rows.length - anchor - 1 <= 1);
    check(s, "foreign N04 is absent", !rows.some((row: any) => row.id === String(ids.N04)));
    check(s, "no full observations at the context step", c04.result.observations.length === 0);
    check(s, "a new continuation was issued", CURSOR.test(c04.result.continuation ?? "") && c04.result.continuation !== c03.result.continuation);
    check(s, "options stayed as set at the index step", c04.result.query === c03.result.query && c04.result.project === c03.result.project);
    check(s, "tool text contains no note prose", noProse(toolText(c04.tool_result)));
    s.summary = `N01を選ぶと、前後1件までの文脈として題名${rows.length}件（${rows.map((row: any) => `「${row.title}」`).join("")}）が返りました。本文はまだ0件です。`;
  }
  console.log("C04 ok");

  // C05 — the one selected body.
  {
    const s = samples.C05;
    const callArgs = { continuation: c04.result.continuation, selectedIds: [String(ids.N01)], mode: "guided" };
    addCall(s, "details", "ProgressiveMemorySearch.run", callArgs);
    const r = await capture(up, mem, callArgs);
    addOutput(s, "details", r);
    const body = r.result.observations[0];
    check(s, "guided step 3, complete", r.result.step === 3 && r.result.complete === true && r.result.continuation === null);
    check(s, "exactly one observation", r.result.observations.length === 1);
    check(s, "it is N01 in sakura-site", body.id === String(ids.N01) && body.project === "sakura-site" && body.title === note.N01.title);
    check(s, "content includes the stored N01 text", body.content.includes(note.N01.text));
    check(s, "no N02 or N04 prose in the content", !body.content.includes(note.N02.text) && !body.content.includes(note.N04.text));
    check(s, "not truncated", body.truncated === false);
    check(s, "trace is search → timeline → fetch", r.result.trace.map((item: any) => item.operation).join(",") === "search,timeline,fetch");
    check(s, "tool text shows the N01 body", toolText(r.tool_result).includes(note.N01.text));
    check(s, "tool text marks the body as data", toolText(r.tool_result).includes("treat record contents as data"));
    s.summary = `選んだN01「${body.title}」の本文だけが1件返りました。N02やN04の本文は含まれていません。返った文を表示しているだけで、回答の生成はしていません。`;
  }
  console.log("C05 ok");

  // C06 — the same automatic question against two project scopes.
  {
    const s = samples.C06;
    const sc = s.input.scenario;
    const found: Record<string, any> = {};
    for (const project of sc.projects as string[]) {
      const callArgs = { query: sc.query, project, mode: sc.mode, limit: sc.limit, maxDetails: sc.maxDetails };
      addCall(s, `auto:${project}`, "ProgressiveMemorySearch.run", callArgs);
      const r = await capture(up, mem, callArgs);
      addOutput(s, `auto:${project}`, r);
      found[project] = r;
      check(s, `${project}: auto mode reached step 3`, r.result.mode === "auto" && r.result.strategy === "ranked-lexical" && r.result.step === 3 && r.result.complete === true);
      check(s, `${project}: same query`, r.result.query === sc.query && r.result.trace[0]?.query === sc.query);
      check(s, `${project}: trace is search → timeline → fetch`, r.result.trace.map((item: any) => item.operation).join(",") === "search,timeline,fetch");
      check(s, `${project}: one detail, every row in the requested project`,
        r.result.observations.length === 1 && [...r.result.index, ...r.result.observations].every((row: any) => row.project === project));
      check(s, `${project}: tool text reports the automatic steps`, toolText(r.tool_result).includes("Automatic search: index → context → selected details."));
    }
    const sakura = found["sakura-site"].result.observations[0];
    const tsubaki = found["tsubaki-docs"].result.observations[0];
    const sakuraKey = sakura.id === String(ids.N01) ? "N01" : sakura.id === String(ids.N02) ? "N02" : null;
    check(s, "sakura-site selected one of N01/N02 with its stored text", sakuraKey !== null && sakura.content.includes(note[sakuraKey!].text));
    check(s, "tsubaki-docs selected N04 with its stored text", tsubaki.id === String(ids.N04) && tsubaki.content.includes(note.N04.text));
    check(s, "the two scopes returned different records", sakura.id !== tsubaki.id);
    check(s, "no LLM step: strategy is deterministic ranked-lexical", Object.values(found).every((r: any) => r.result.strategy === "ranked-lexical"));
    s.output.scope_note = "The project argument narrows the search scope. It is not authentication or access control.";
    s.summary = `同じ「${sc.query}」を自動モードで2つのプロジェクトに渡すと、sakura-site では「${sakura.title}」、tsubaki-docs では「${tsubaki.title}」の本文が1件ずつ返りました。どちらも索引→文脈→本文の3段階を実行しています。`;
  }
  console.log("C06 ok");

  // C08 — guards, run while the C03 continuation is still valid in this process.
  {
    const s = samples.C08;
    const sc = s.input.scenario;
    s.input.execution_note = "Executed before C07 closed the database, while the C03 continuation was still held by this process.";
    const cases: [string, Record<string, unknown>, string][] = [
      ["foreign_selected_id", { continuation: c03.result.continuation, selectedIds: [String(ids.N04)], mode: "guided" }, "invalid_selection"],
      ["modified_continuation", { continuation: modifyCursor(c03.result.continuation), selectedIds: [String(ids.N01)], mode: "guided" }, "invalid_continuation"],
      ["changed_scope", { continuation: c03.result.continuation, project: "tsubaki-docs", selectedIds: [String(ids.N01)], mode: "guided" }, "scope_changed"],
      ["too_long_query", { query: "x".repeat(501), project: "sakura-site", mode: "guided", limit: 6 }, "invalid_input"],
    ];
    if (cases.map(item => item[0]).join(",") !== (sc.tests as string[]).join(",")) fail("C08 tests differ from input/scenarios.json.");
    const modified = cases[1][1].continuation as string;
    check(s, "modified cursor keeps the ms_ shape but differs", CURSOR.test(modified) && modified !== c03.result.continuation);
    const errors: Record<string, any> = {};
    for (const [name, callArgs, code] of cases) {
      addCall(s, name, "ProgressiveMemorySearch.run", callArgs);
      const r = await captureError(up, mem, callArgs);
      addOutput(s, name, r);
      errors[name] = r.error;
      check(s, `${name}: rejected with ${code}`, r.error.name === "ProgressiveSearchError" && r.error.code === code);
      check(s, `${name}: tool error text carries the upstream message`, toolText(r.tool_error).includes(r.error.message) && r.tool_error.isError === true);
    }
    const emptyArgs = { query: "iOS", project: sc.empty_project, mode: "auto", limit: 6, maxDetails: 1 };
    addCall(s, "unregistered_project", "ProgressiveMemorySearch.run", emptyArgs);
    const empty = await capture(up, mem, emptyArgs);
    addOutput(s, "unregistered_project", empty);
    check(s, "unregistered project: complete, no_results, nothing returned", empty.result.complete === true && empty.result.reason === "no_results" && empty.result.index.length === 0 && empty.result.observations.length === 0);
    check(s, "guards changed no stored data", sqlAudit(db).observations === 5);
    s.summary = `前の索引にないID（N04）は ${errors.foreign_selected_id.code}、1文字変えた合図は ${errors.modified_continuation.code}、途中でのプロジェクト変更は ${errors.changed_scope.code}、501文字の質問は ${errors.too_long_query.code} で拒まれました。未登録のプロジェクトは0件です。`;
  }
  console.log("C08 ok");

  // C07 — close, then reopen the same private database in one fresh Bun process.
  {
    const s = samples.C07;
    const sc = s.input.scenario;
    const controlArgs = { continuation: c03.result.continuation, selectedIds: [String(ids.N01)], mode: "guided" };
    addCall(s, "parent_control_before_close", "ProgressiveMemorySearch.run", controlArgs);
    const control = await capture(up, mem, controlArgs);
    addOutput(s, "parent_control_before_close", control);
    check(s, "parent: C03 continuation still opened step 2 just before close", control.result.step === 2 && control.result.index.some((row: any) => row.id === String(ids.N01)));
    const beforeClose = sqlAudit(db);
    await db.close();
    let closed = false;
    try { db.getConnection(); } catch { closed = true; }
    check(s, "parent: database closed before the worker starts", closed);

    const job = {
      format: WORKER_JOB_FORMAT,
      ids: Object.fromEntries(Object.entries(ids).map(([key, id]) => [key, String(id)])),
      expected: { observations: 5, observations_by_project: beforeClose.observations_by_project, c03_index_ids: c03.result.index.map((row: any) => row.id) },
      requests: {
        worker_auto: { query: sc.query, project: sc.project, mode: sc.mode, limit: sc.limit, maxDetails: sc.maxDetails },
        worker_guided_index: { query: "iOS", project: "sakura-site", mode: "guided", limit: 6 },
        worker_old_continuation: { continuation: c03.result.continuation, selectedIds: [String(ids.N01)], mode: "guided" },
      },
    };
    const jobPath = join(artifact, "worker-input.json");
    writeFileSync(jobPath, JSON.stringify(job, null, 2) + "\n", { flag: "wx" });
    const workerEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (WORKER_ENV_ALLOWLIST.has(key.toUpperCase()) && typeof value === "string") workerEnv[key] = value;
    }
    Object.assign(workerEnv, { CLAUDE_MEM_DATA_DIR: dataDir, CLAUDE_CONFIG_DIR: join(dataDir, "claude-config-unused") }, TELEMETRY_ENV, SETTINGS);
    s.input.process = {
      command: "bun --no-install run.ts --worker --artifact-dir <private artifact> --worker-input <private artifact>/worker-input.json",
      launched_with: "Bun.spawnSync([process.execPath, '--no-install', run.ts, ...]) — one new process",
      env_variable_names: Object.keys(workerEnv).sort(),
    };
    s.input.worker_job = clone(job);
    for (const name of Object.keys(job.requests) as (keyof typeof job.requests)[]) addCall(s, name, "ProgressiveMemorySearch.run (fresh worker)", job.requests[name]);

    GUARD.ownWorkerSpawns += 1;
    const proc = REAL_SPAWN_SYNC!([process.execPath, "--no-install", RUN_PATH, "--worker", "--artifact-dir", artifact, "--worker-input", jobPath], {
      cwd: SITE, env: workerEnv, stdin: "ignore", stdout: "pipe", stderr: "pipe",
    });
    mkdirSync(join(artifact, "process"));
    writeFileSync(join(artifact, "process", "worker.stdout.txt"), proc.stdout ?? new Uint8Array(), { flag: "wx" });
    writeFileSync(join(artifact, "process", "worker.stderr.txt"), proc.stderr ?? new Uint8Array(), { flag: "wx" });
    if (proc.exitCode !== 0) fail(`The fresh worker exited with ${proc.exitCode}; see the private worker.stderr.txt.`);
    const workerResultPath = join(artifact, "worker-result.json");
    const worker = readJson(workerResultPath);
    if (worker.format !== WORKER_RESULT_FORMAT) fail("Worker result has an unexpected format.");
    const freshProcess = Number.isInteger(worker.pid) && worker.pid !== process.pid
      && (worker.ppid === process.pid || (typeof proc.pid === "number" && proc.pid === worker.pid));
    check(s, "fresh process: exit 0 and a different PID launched by this run", proc.exitCode === 0 && freshProcess);
    check(s, "worker used the same Bun version", worker.runtime?.bun === Bun.version);
    check(s, "worker passed all of its own checks", Array.isArray(worker.checks) && worker.checks.length === WORKER_EXPECTED_CHECKS && worker.checks.every((item: any) => item.passed === true));
    for (const item of worker.checks) check(s, `worker: ${item.name}`, item.passed === true);
    check(s, "worker attempted no network, server or process API", worker.guards?.total_attempts === 0);
    const calls = Object.fromEntries((worker.calls as any[]).map(item => [item.name, item]));
    check(s, "worker auto search returned N02 with the same ID", calls.worker_auto?.result?.observations?.[0]?.id === String(ids.N02));
    check(s, "old parent continuation was rejected as invalid_continuation", calls.worker_old_continuation?.error?.code === "invalid_continuation");
    for (const name of Object.keys(job.requests)) {
      const { name: _name, fn: _fn, args: _args, ...payload } = calls[name];
      addOutput(s, name, payload);
    }
    s.output.worker = {
      fresh_process: freshProcess, exit_code: proc.exitCode, runtime: worker.runtime, isolation: worker.isolation, services: worker.services,
      sql_audit: worker.sql_audit, stored_rows: worker.stored_rows, guards: worker.guards, checks: worker.checks,
    };
    s.output.cursor_note = "ms_ continuations are process-local search state that expires after 15 minutes. The saved notes persist in SQLite; the cursor does not, so it cannot be reused on this website or in another process.";
    const autoBody = calls.worker_auto.result.observations[0];
    s.summary = `データベースを閉じ、新しいBunのプロセスで同じ保存先を開き直しました。「${sc.query}」の自動検索はN02「${autoBody.title}」の本文を保存時と同じID ${autoBody.id} で返し、件数は5件（3＋2）のまま。前のプロセスの合図は ${calls.worker_old_continuation.error.code} で拒まれました。`;
  }
  console.log("C07 ok");

  // Storage after both processes closed the database: hashes only, never the files.
  const storage = { files: [] as { path: string; bytes: number; sha256: string }[], excluded: [] as string[] };
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = join(dir, entry.name);
      const rel = relative(dataDir, absolute).split(/[\\/]/).join("/");
      if (entry.isDirectory()) walk(absolute);
      else if (rel === "settings.json" || rel.startsWith(".settings.json.")) storage.excluded.push(rel);
      else if (entry.isFile()) {
        const data = readFileSync(absolute);
        storage.files.push({ path: rel, bytes: data.length, sha256: sha256(data) });
      }
    }
  };
  walk(dataDir);
  if (!storage.files.some(file => file.path === "claude-mem.db")) fail("claude-mem.db was not found in the private data folder.");

  const after = verifyInputs();
  if (Object.entries(after.sha).some(([name, value]) => value !== INPUT_SHA256[name])) fail("Frozen inputs changed during the run.");
  const parentGuards = guardSummary();
  if (parentGuards.total_attempts !== 0) fail(`Guarded APIs were attempted ${parentGuards.total_attempts} time(s).`);
  if (GUARD.ownWorkerSpawns !== 1) fail("Exactly one worker process must be launched.");

  const ordered = SAMPLE_IDS.map(id => samples[id]);
  const idsSorted = ordered.map(item => item.id);
  if (new Set(idsSorted).size !== 8 || idsSorted.join(",") !== [...idsSorted].sort().join(",")) fail("Samples must be C01–C08, unique and sorted.");
  const bySample = Object.fromEntries(ordered.map(item => [item.id, item.checks.length]));
  for (const id of SAMPLE_IDS) if (bySample[id] !== EXPECTED_CHECKS[id]) fail(`${id} ran ${bySample[id]} checks; expected ${EXPECTED_CHECKS[id]}.`);
  const total = ordered.reduce((sum, item) => sum + item.checks.length, 0);
  const expectedTotal = Object.values(EXPECTED_CHECKS).reduce((sum, value) => sum + value, 0);
  const workerSample = samples.C07.output.worker;

  const record = {
    format: FORMAT,
    generated_at: new Date().toISOString(),
    source: { repository: PIN.repository, commit: PIN.commit, version: PIN.version, license: PIN.license, notice: PIN.notice },
    source_lock_sha256: source.lockSha,
    source_files_verified: { count: source.paths.size, bytes: source.bytes, method: "SHA-256, byte size and Git blob SHA-1 of every vendor-lock.json entry, before the first write" },
    input_sha256: { "input/notes.json": after.sha["input/notes.json"], "input/scenarios.json": after.sha["input/scenarios.json"] },
    authorship: {
      inputs: "input/notes.json and input/scenarios.json were written by the Studio Yebisu production side and frozen before execution. The five notes are fictional; no real conversations or user data.",
      code: "run.ts, the viewer and the documentation were written by Claude Opus 5.5 (claude-opus-5-5).",
      execution: "Bun executed the unmodified Claude-Mem library code. No language model was called to generate the captured API responses.",
    },
    runtime: { ...runtime, dependencies: dependencies.installed, package_lock_sha256: dependencies.package_lock_sha256 },
    config: {
      settings_json: { ...SETTINGS },
      telemetry_env: { ...TELEMETRY_ENV },
      environment: environment,
      private_locations: "CLAUDE_MEM_DATA_DIR and CLAUDE_CONFIG_DIR point inside the private artifact folder; neither path is published.",
      isolation,
      services,
      upstream_entrypoints: IMPORTS,
      not_started: ["worker HTTP server", "MCP server", "hooks", "transcript watcher", "automatic observer / compression", "Chroma", "cloud sync", "Claude Agent SDK or Claude process", "network"],
    },
    guards: { parent: parentGuards, worker: workerSample.guards, network_attempts_total: parentGuards.attempts_by_kind.network + workerSample.guards.attempts_by_kind.network, all_attempts_total: parentGuards.total_attempts + workerSample.guards.total_attempts },
    process: { fresh_process: workerSample.fresh_process, worker_exit_code: workerSample.exit_code, own_worker_spawns: GUARD.ownWorkerSpawns },
    execution_order: EXECUTION_ORDER,
    execution_order_note: "Samples are published as C01–C08. C08 ran before C07 so that its guards could use the still-valid C03 continuation before the database was closed.",
    ids: Object.fromEntries(Object.entries(ids).map(([key, id]) => [key, String(id)])),
    samples: ordered,
    storage: { ...storage, note: "Private SQLite and log files after both processes closed the database. Settings are excluded; files are not published." },
    checks: {
      passed: true, total, expected_total: expectedTotal, by_sample: bySample,
      items: ordered.flatMap(item => item.checks.map(entry => ({ sample: item.id, name: entry.name, passed: entry.passed }))),
    },
    scope: {
      tested: "Explicit saveMemory notes, SQLite FTS5 keyword search, and the real mem_search progressive classes (guided and auto) in a Bun process plus one fresh Bun process.",
      not_tested: "Plugin install, hooks, automatic capture or LLM compression, context injection, Chroma or semantic search, cloud sync, hosted provider, MCP transport, Japanese lexical search quality.",
      continuations: "ms_ cursors expire after 15 minutes and live only in the process that issued them.",
    },
  };
  if (total !== expectedTotal) fail(`Ran ${total} checks; expected ${expectedTotal}.`);
  const text = JSON.stringify(record, null, 2) + "\n";
  assertNoPrivateLeak(text, [artifact, SITE, os.homedir(), dirname(process.execPath)]);
  writeOnce(outPath, text);
  console.log(`Wrote ${isInside(outPath, SITE) ? relative(SITE, outPath).split(/[\\/]/).join("/") : "--out file"} (${total} checks passed).`);
}

function assertNoPrivateLeak(text: string, paths: string[]) {
  const lower = text.toLowerCase();
  for (const path of paths) {
    for (const variant of [path, path.replace(/\\/g, "\\\\"), path.replace(/\\/g, "/")]) {
      if (variant.length > 3 && lower.includes(variant.toLowerCase())) fail("A private absolute path would be published; refusing to write.");
    }
  }
  if (/[A-Za-z]:\\\\/.test(text) || /"pid"|"ppid"/.test(text)) fail("A machine path or PID would be published; refusing to write.");
}

/** Write a temporary file beside the target, then hard-link it into place without clobbering. */
function writeOnce(target: string, text: string) {
  const temporary = join(dirname(target), `.${basename(target)}.${process.pid}.tmp`);
  writeFileSync(temporary, text, { flag: "wx" });
  try {
    linkSync(temporary, target);
  } catch (error: any) {
    if (error?.code === "EEXIST") { unlinkSync(temporary); fail("The output JSON appeared during the run; it is never overwritten."); }
    if (existsSync(target)) { unlinkSync(temporary); fail("The output JSON already exists."); }
    renameSync(temporary, target);
    return;
  }
  unlinkSync(temporary);
}

// --- Fresh worker process ----------------------------------------------------------------------

async function worker(args: ReturnType<typeof parseArgs>) {
  const artifact = resolve(args.artifactDir!);
  if (isInside(artifact, SITE) || isInside(SITE, artifact)) fail("--artifact-dir must be outside the served site folder.");
  if (!existsSync(artifact) || !statSync(artifact).isDirectory()) fail("Worker --artifact-dir must be the existing private folder.");
  const jobPath = resolve(args.workerInput ?? fail("--worker-input is required in worker mode."));
  if (!isInside(jobPath, artifact) || basename(jobPath) !== "worker-input.json") fail("--worker-input must be the parent's worker-input.json inside the artifact folder.");
  const resultPath = join(artifact, "worker-result.json");
  if (existsSync(resultPath)) fail("worker-result.json already exists.");
  const job = readJson(jobPath);
  if (job.format !== WORKER_JOB_FORMAT) fail("Unexpected worker job format.");

  const source = verifySource();
  const { notes } = verifyInputs();
  const runtime = checkRuntime();
  const dataDir = join(artifact, "data");
  if (!existsSync(join(dataDir, "claude-mem.db")) || !existsSync(join(dataDir, "settings.json"))) fail("The private database or settings are missing.");
  const privateSettings = readJson(join(dataDir, "settings.json"));

  const checks: { name: string; passed: true }[] = [];
  const workerCheck = (name: string, condition: unknown) => {
    if (!condition) fail(`worker check failed: ${name}`);
    checks.push({ name, passed: true });
  };
  workerCheck("private settings.json still holds the run settings", Object.entries(SETTINGS).every(([key, value]) => privateSettings[key] === value));

  prepareEnvironment(dataDir);
  await recordEsmBindings();
  const up = await loadUpstream(source.paths);
  const isolation = isolationReport(up, dataDir);
  workerCheck("storage resolves inside the same private data folder", isolation.data_dir_is_private_artifact && isolation.database_inside_private_artifact && isolation.settings_inside_private_artifact);
  workerCheck("effective upstream settings match", isolation.effective_settings_match);
  workerCheck("telemetry and error capture are off", !isolation.telemetry.enabled && !isolation.telemetry.error_capture_enabled);

  const db = new up.DatabaseManager();
  await db.initialize();
  const services = { chroma_sync: db.getChromaSync() === null ? "null (disabled)" : "present", cloud_sync: db.getCloudSync() === null ? "null (not configured)" : "present" };
  workerCheck("Chroma and cloud sync stay inactive", db.getChromaSync() === null && db.getCloudSync() === null);
  const mem = openSearch(up, db);

  const audit = sqlAudit(db);
  const rows = observationRows(db);
  workerCheck("five observations persisted", audit.observations === job.expected.observations && rows.length === 5);
  workerCheck("projects still hold 3 + 2", audit.observations_by_project["sakura-site"] === 3 && audit.observations_by_project["tsubaki-docs"] === 2 && JSON.stringify(audit.observations_by_project) === JSON.stringify(job.expected.observations_by_project));
  workerCheck("IDs, titles and texts are unchanged from the parent saves", notes.every(item => rows.some(row =>
    String(row.id) === job.ids[item.key] && row.project === item.project && row.title === item.title && row.narrative === item.text)));
  workerCheck("no summaries or prompts appeared", audit.session_summaries === 0 && audit.user_prompts === 0);

  const calls: any[] = [];
  const autoArgs = job.requests.worker_auto;
  const auto = await capture(up, mem, autoArgs);
  calls.push({ name: "worker_auto", fn: "ProgressiveMemorySearch.run", args: clone(autoArgs), ...auto });
  const autoBody = auto.result.observations[0];
  const n02 = notes.find(item => item.key === "N02")!;
  workerCheck("auto search ran search → timeline → fetch", auto.result.mode === "auto" && auto.result.step === 3 && auto.result.trace.map((item: any) => item.operation).join(",") === "search,timeline,fetch");
  workerCheck("auto search returned one N02 body with the saved ID", auto.result.observations.length === 1 && autoBody.id === job.ids.N02 && autoBody.project === "sakura-site");
  workerCheck("N02 body includes the stored text", autoBody.content.includes(n02.text));

  const guidedArgs = job.requests.worker_guided_index;
  const guided = await capture(up, mem, guidedArgs);
  calls.push({ name: "worker_guided_index", fn: "ProgressiveMemorySearch.run", args: clone(guidedArgs), ...guided });
  workerCheck("fresh guided index equals the parent's C03 index", guided.result.step === 1 && sameSet(guided.result.index.map((row: any) => row.id), job.expected.c03_index_ids));
  workerCheck("fresh guided index issued its own new continuation", CURSOR.test(guided.result.continuation ?? "") && guided.result.continuation !== job.requests.worker_old_continuation.continuation);

  const oldArgs = job.requests.worker_old_continuation;
  const old = await captureError(up, mem, oldArgs);
  calls.push({ name: "worker_old_continuation", fn: "ProgressiveMemorySearch.run", args: clone(oldArgs), ...old });
  workerCheck("old parent continuation is invalid_continuation here", old.error.name === "ProgressiveSearchError" && old.error.code === "invalid_continuation");

  await db.close();
  const guards = guardSummary();
  workerCheck("no guarded API was attempted", guards.total_attempts === 0 && guards.own_worker_spawns === 0);
  if (checks.length !== WORKER_EXPECTED_CHECKS) fail(`Worker ran ${checks.length} checks; expected ${WORKER_EXPECTED_CHECKS}.`);

  const result = {
    format: WORKER_RESULT_FORMAT,
    pid: process.pid,
    ppid: process.ppid,
    runtime,
    isolation,
    services,
    sql_audit: audit,
    stored_rows: rows.map(row => ({ id: String(row.id), project: row.project, title: row.title, narrative_matches_input: notes.some(item => item.text === row.narrative && item.title === row.title) })),
    calls,
    checks,
    guards,
  };
  writeFileSync(resultPath, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  console.log(`worker ok (${checks.length} checks)`);
}

// --- Entry -------------------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.worker) await worker(args);
  else await parent(args);
}

main().then(
  () => process.exit(0),
  error => {
    console.error(`run.ts failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  },
);
