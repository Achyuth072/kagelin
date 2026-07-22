import { get, set } from "idb-keyval";
import { createClient } from "@/lib/supabase/client";

// Guests persist to their own IndexedDB key rather than the localStorage hot
// blob (mock-store), so a multi-hundred-KB raw parse doesn't get re-serialized
// on every habit mutation or bump against the ~5MB localStorage cap.
const GUEST_STORE_KEY = "kanso_import_sources";

export interface ImportSourcePayload {
  source_app: string;
  file_name: string | null;
  // The raw parsed source, verbatim (e.g. { habits, repetitions } from uhabits).
  raw: unknown;
}

interface StoredImportSource extends ImportSourcePayload {
  captured_at: string;
}

/** Persist the raw import source for round-trip export (ADR 0006). */
export async function persistImportSource(
  payload: ImportSourcePayload,
  opts: { isGuest: boolean },
): Promise<void> {
  if (opts.isGuest) {
    // Guest has no DB default, so stamp the capture time here.
    const record: StoredImportSource = {
      ...payload,
      captured_at: new Date().toISOString(),
    };
    const existing = (await get<StoredImportSource[]>(GUEST_STORE_KEY)) ?? [];
    await set(GUEST_STORE_KEY, [...existing, record]);
    return;
  }

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("habit_imports").insert({
    user_id: user.id,
    source_app: payload.source_app,
    file_name: payload.file_name,
    raw: payload.raw,
  });
  if (error) throw error;
}
