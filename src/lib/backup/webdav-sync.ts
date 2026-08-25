import type { BackupData } from "./types";
import { parseBackupZip } from "./export-import";

export interface WebDAVCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

export interface WebDAVResult {
  success: boolean;
  error?: string;
  isCorsError?: boolean;
}

// Matches manual export filename so WebDAV backups round-trip through import.
const BACKUP_FILENAME = "kanso-backup.zip";

function buildProxyUrl(serverUrl: string, path: string = ""): string {
  const cleanPath = path.replace(/^\//, "");
  return cleanPath ? `/api/webdav/${cleanPath}` : `/api/webdav/`;
}

function buildProxyHeaders(
  credentials: WebDAVCredentials,
): Record<string, string> {
  return {
    "X-WebDAV-URL": credentials.serverUrl,
    Authorization: `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`,
  };
}

export async function testWebDavConnection(
  credentials: WebDAVCredentials,
): Promise<WebDAVResult> {
  try {
    // Uses OPTIONS rather than PROPFIND because App Router only exports standard HTTP methods.
    const response = await fetch(buildProxyUrl(credentials.serverUrl), {
      method: "OPTIONS",
      headers: buildProxyHeaders(credentials),
    });

    if (response.ok || response.status === 204 || response.status === 200) {
      return { success: true };
    }
    if (response.status === 401) {
      return { success: false, error: "Invalid username or password" };
    }
    return { success: false, error: `Server returned ${response.status}` };
  } catch (error: unknown) {
    return handleWebDAVError(error);
  }
}

export async function uploadWebDavBackup(
  credentials: WebDAVCredentials,
  backupZip: Blob,
  filename: string = BACKUP_FILENAME,
): Promise<WebDAVResult> {
  try {
    const response = await fetch(
      buildProxyUrl(credentials.serverUrl, filename),
      {
        method: "PUT",
        headers: {
          ...buildProxyHeaders(credentials),
          "Content-Type": "application/zip",
        },
        body: backupZip,
      },
    );

    if (response.ok || response.status === 201 || response.status === 204) {
      return { success: true };
    }
    if (response.status === 401) {
      return { success: false, error: "Invalid username or password" };
    }
    return { success: false, error: `Server returned ${response.status}` };
  } catch (error: unknown) {
    return handleWebDAVError(error);
  }
}

export async function downloadWebDavBackup(
  credentials: WebDAVCredentials,
  filename: string = BACKUP_FILENAME,
): Promise<{
  success: boolean;
  data?: BackupData;
  error?: string;
  isCorsError?: boolean;
}> {
  try {
    const response = await fetch(
      buildProxyUrl(credentials.serverUrl, filename),
      {
        method: "GET",
        headers: buildProxyHeaders(credentials),
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: "No backup found on server" };
      }
      if (response.status === 401) {
        return { success: false, error: "Invalid username or password" };
      }
      return { success: false, error: `Server returned ${response.status}` };
    }

    const data = await parseBackupZip(await response.blob());

    return { success: true, data };
  } catch (error: unknown) {
    const result = handleWebDAVError(error);
    return { ...result, data: undefined };
  }
}

function handleWebDAVError(error: unknown): WebDAVResult {
  const message = error instanceof Error ? error.message : String(error);

  const isCorsError =
    message.includes("CORS") ||
    message.includes("NetworkError") ||
    message.includes("Failed to fetch") ||
    message.includes("Load failed");

  if (isCorsError) {
    return {
      success: false,
      isCorsError: true,
      error:
        "CORS blocked. Your WebDAV server needs to allow cross-origin requests. " +
        "Check your server's CORS configuration (Nextcloud: enable the 'CORS' app).",
    };
  }

  if (message.includes("401") || message.includes("Unauthorized")) {
    return {
      success: false,
      error: "Invalid username or password",
    };
  }

  return {
    success: false,
    error: message,
  };
}
