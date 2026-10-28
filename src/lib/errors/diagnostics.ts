import { get, set, del } from "idb-keyval";
import {
  isSafeErrorMessage,
  stripQuery,
  REDACTED,
} from "@/lib/errors/scrubEvent";

export const DIAGNOSTIC_ERRORS_KEY = "kanso_diagnostic_errors";
export const MAX_DIAGNOSTIC_ERRORS = 30;

export interface DiagnosticErrorRecord {
  id: string;
  timestamp: string;
  name: string;
  message: string;
  stack?: string;
  digest?: string;
  context?: Record<string, unknown>;
}

const SAFE_NAME_REGEX = /^[A-Za-z0-9_$.-]{1,64}$/;
const SAFE_DIGEST_REGEX = /^[A-Za-z0-9_$.-]{1,128}$/;
const SAFE_STRING_REGEX = /^[A-Za-z0-9_./-]{1,128}$/;

const SAFE_CONTEXT_KEYS = new Set([
  "source",
  "route",
  "phase",
  "action",
  "status",
  "statusCode",
  "component",
  "digest",
  "method",
  "count",
  "pushOperation",
  "swState",
  "failureIndex",
  "failedCount",
]);

function extractErrorName(error: unknown): string {
  if (typeof error === "object" && error !== null && "name" in error) {
    const n = (error as { name?: unknown }).name;
    if (typeof n === "string" && SAFE_NAME_REGEX.test(n)) {
      return n;
    }
  }
  return "Error";
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return isSafeErrorMessage(error) ? error : REDACTED;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    return isSafeErrorMessage(msg) ? msg : REDACTED;
  }
  return REDACTED;
}

function extractDigest(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "digest" in error) {
    const d = (error as { digest?: unknown }).digest;
    if (typeof d === "string" && SAFE_DIGEST_REGEX.test(d)) {
      return d;
    }
  }
  return undefined;
}

function extractScrubbedStack(
  error: unknown,
  name: string,
  message: string,
): string | undefined {
  if (
    typeof error !== "object" ||
    error === null ||
    !("stack" in error) ||
    typeof (error as { stack?: unknown }).stack !== "string"
  ) {
    return undefined;
  }

  const rawStack = (error as { stack: string }).stack;
  if (!rawStack) return undefined;

  const lines = rawStack.split("\n");
  // Replace line 0 with the scrubbed error header so sensitive messages never leak through stack traces.
  const scrubbedLines = [
    `${name}: ${message}`,
    ...lines.slice(1).map((line) => line.replace(/([?#][^:)\s]*)/g, "")),
  ];
  return scrubbedLines.join("\n");
}

function scrubContext(
  context?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!context || typeof context !== "object") return undefined;

  const scrubbed: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(context)) {
    if (!SAFE_CONTEXT_KEYS.has(key)) continue;

    if (typeof val === "boolean" || typeof val === "number") {
      scrubbed[key] = val;
      continue;
    }

    if (typeof val === "string") {
      if (key === "route") {
        scrubbed[key] = stripQuery(val);
      } else {
        scrubbed[key] = SAFE_STRING_REGEX.test(val) ? val : REDACTED;
      }
    }
  }

  return Object.keys(scrubbed).length > 0 ? scrubbed : undefined;
}

function createDiagnosticRecord(
  error: unknown,
  context?: Record<string, unknown>,
): DiagnosticErrorRecord {
  const name = extractErrorName(error);
  const message = extractErrorMessage(error);
  const digest = extractDigest(error);
  const stack = extractScrubbedStack(error, name, message);
  const scrubbedContext = scrubContext(context);

  const timestamp = new Date().toISOString();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  return {
    id,
    timestamp,
    name,
    message,
    stack,
    digest,
    context: scrubbedContext,
  };
}

let inMemoryErrors: DiagnosticErrorRecord[] = [];
let writeQueue: Promise<void> = Promise.resolve();
// IndexedDB ops are best-effort with the in-memory buffer as fallback; the
// flag tracks failed persistence (only writes clear it) and is surfaced in
// the exported report.
let idbPersistFailed = false;

export async function getDiagnosticErrors(): Promise<DiagnosticErrorRecord[]> {
  await writeQueue.catch(() => {});
  try {
    const records = await get<DiagnosticErrorRecord[]>(DIAGNOSTIC_ERRORS_KEY);
    if (Array.isArray(records)) {
      return records;
    }
  } catch {
    idbPersistFailed = true;
  }
  return [...inMemoryErrors];
}

export async function recordDiagnosticError(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    const record = createDiagnosticRecord(error, context);
    inMemoryErrors = [...inMemoryErrors, record].slice(-MAX_DIAGNOSTIC_ERRORS);

    writeQueue = writeQueue
      .catch(() => {})
      .then(async () => {
        try {
          const existing = await get<DiagnosticErrorRecord[]>(
            DIAGNOSTIC_ERRORS_KEY,
          );
          const list = Array.isArray(existing) ? existing : [];
          list.push(record);
          const capped = list.slice(-MAX_DIAGNOSTIC_ERRORS);
          await set(DIAGNOSTIC_ERRORS_KEY, capped);
          idbPersistFailed = false;
        } catch {
          idbPersistFailed = true;
        }
      });

    await writeQueue;
  } catch {}
}

export async function clearDiagnosticErrors(): Promise<void> {
  inMemoryErrors = [];
  writeQueue = writeQueue
    .catch(() => {})
    .then(async () => {
      try {
        await del(DIAGNOSTIC_ERRORS_KEY);
        idbPersistFailed = false;
      } catch {
        idbPersistFailed = true;
      }
    });
  await writeQueue;
}

export interface DiagnosticStorageInfo {
  usageMb: number;
  quotaMb: number;
  percentUsed: number;
  persisted: boolean;
}

export interface DiagnosticServiceWorkerInfo {
  controllerActive: boolean;
  state?: string;
}

export interface DiagnosticSyncHealthInfo {
  pendingMutationsCount: number;
}

export interface DiagnosticSystemInfo {
  appVersion: string;
  releaseChannel: string;
  userAgent: string;
  language: string;
  timeZone: string;
  standalone: boolean;
  online: boolean;
  tier?: "guest" | "registered" | "premium";
  storage?: DiagnosticStorageInfo;
  serviceWorker?: DiagnosticServiceWorkerInfo;
  syncHealth?: DiagnosticSyncHealthInfo;
}

export interface DiagnosticReportOptions {
  tier?: "guest" | "registered" | "premium";
  pendingMutationsCount?: number;
}

function getSystemInfo() {
  let userAgent = "unknown";
  let language = "unknown";
  let timeZone = "UTC";
  let standalone = false;
  let online = true;

  if (typeof navigator !== "undefined") {
    userAgent = navigator.userAgent || "unknown";
    language = navigator.language || "unknown";
    online = navigator.onLine ?? true;
  }

  if (typeof window !== "undefined") {
    try {
      standalone = window.matchMedia("(display-mode: standalone)").matches;
    } catch {}
  }

  if (typeof Intl?.DateTimeFormat === "function") {
    try {
      timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {}
  }

  return {
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0",
    releaseChannel: process.env.NEXT_PUBLIC_RELEASE_CHANNEL || "preview",
    userAgent,
    language,
    timeZone,
    standalone,
    online,
  };
}

async function getStorageInfo(): Promise<DiagnosticStorageInfo | undefined> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return undefined;
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const toMb = (bytes: number) =>
      Math.round((bytes / (1024 * 1024)) * 10) / 10;
    const percentUsed = quota > 0 ? Math.round((usage / quota) * 1000) / 10 : 0;

    let persisted = false;
    if (typeof navigator.storage.persisted === "function") {
      try {
        persisted = await navigator.storage.persisted();
      } catch {}
    }

    return {
      usageMb: toMb(usage),
      quotaMb: toMb(quota),
      percentUsed,
      persisted,
    };
  } catch {
    return undefined;
  }
}

export async function getExtendedSystemInfo(
  options?: DiagnosticReportOptions,
): Promise<DiagnosticSystemInfo> {
  const base = getSystemInfo();
  const storage = await getStorageInfo();

  const controller =
    typeof navigator !== "undefined" && "serviceWorker" in navigator
      ? navigator.serviceWorker?.controller
      : undefined;

  const serviceWorker: DiagnosticServiceWorkerInfo = controller
    ? { controllerActive: true, state: controller.state }
    : { controllerActive: false };

  const syncHealth: DiagnosticSyncHealthInfo = {
    pendingMutationsCount: options?.pendingMutationsCount ?? 0,
  };

  return {
    ...base,
    tier: options?.tier,
    storage,
    serviceWorker,
    syncHealth,
  };
}

export async function exportDiagnosticReport(
  currentError?: unknown,
  options?: DiagnosticReportOptions,
): Promise<string> {
  let errors = await getDiagnosticErrors();

  if (currentError !== undefined) {
    const currentRecord = createDiagnosticRecord(currentError, {
      source: "export",
    });
    const latest = errors[errors.length - 1];
    const isDuplicate =
      latest &&
      latest.name === currentRecord.name &&
      latest.message === currentRecord.message &&
      latest.digest === currentRecord.digest;

    if (!isDuplicate) {
      errors = [...errors, currentRecord].slice(-MAX_DIAGNOSTIC_ERRORS);
    }
  }

  const sys = await getExtendedSystemInfo(options);
  const now = new Date().toISOString();

  const storageStr = sys.storage
    ? `${sys.storage.usageMb} MB / ${sys.storage.quotaMb} MB (${sys.storage.percentUsed}% used, ${sys.storage.persisted ? "persistent" : "best-effort"})`
    : "unavailable";

  const swStr = sys.serviceWorker?.controllerActive
    ? `active${sys.serviceWorker.state ? ` (${sys.serviceWorker.state})` : ""}`
    : "none";

  const lines: string[] = [
    "### Kagelin Diagnostic Report",
    `**Generated:** ${now}`,
    "",
    "#### System Information",
    `- **App Version:** \`${sys.appVersion}\``,
    `- **Release Channel:** \`${sys.releaseChannel}\``,
    `- **Tier:** \`${sys.tier ?? "unknown"}\``,
    `- **User Agent:** \`${sys.userAgent}\``,
    `- **Time Zone:** \`${sys.timeZone}\``,
    `- **Language:** \`${sys.language}\``,
    `- **Standalone:** \`${sys.standalone}\``,
    `- **Online:** \`${sys.online}\``,
    `- **Storage:** \`${storageStr}\``,
    `- **Service Worker:** \`${swStr}\``,
    `- **Pending Offline Mutations:** \`${sys.syncHealth?.pendingMutationsCount ?? 0}\``,
    "",
  ];

  if (idbPersistFailed) {
    lines.push(
      "**Note:** IndexedDB persistence failed — some recently recorded events may be missing from this report.",
      "",
    );
  }

  if (errors.length === 0) {
    lines.push("*No diagnostic errors recorded.*");
    return lines.join("\n");
  }

  lines.push(
    `#### Error Log (${errors.length} event${errors.length === 1 ? "" : "s"})`,
  );

  for (const [index, err] of errors.entries()) {
    lines.push(
      "",
      `##### ${index + 1}. ${err.name} — ${err.timestamp}`,
      `- **Message:** \`${err.message}\``,
    );
    if (err.digest) {
      lines.push(`- **Digest:** \`${err.digest}\``);
    }
    if (err.context && Object.keys(err.context).length > 0) {
      lines.push(`- **Context:** \`${JSON.stringify(err.context)}\``);
    }
    if (err.stack) {
      lines.push("", "```", err.stack, "```");
    }
  }

  return lines.join("\n");
}
