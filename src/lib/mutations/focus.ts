import { createClient } from "@/lib/supabase/client";
import { mockStore } from "@/lib/mock/mock-store";
import type { TimerSettings } from "@/lib/types/timer";

export interface LogFocusSessionInput {
  task_id: string;
  durationSeconds: number;
}

export interface UpsertTimerStateInput {
  user_id: string;
  mode: string;
  remaining_seconds: number;
  is_running: boolean;
  active_task_id: string | null;
  ends_at: string | null;
  source_device_id: string;
  completed_sessions: number;
  settings: TimerSettings;
  updated_at?: string;
}

export interface ClaimTimerCompletionInput extends UpsertTimerStateInput {
  // The deadline (ISO) of the session being completed. The write only succeeds
  // if the DB row still shows that running session — so among several devices
  // finishing the same session at once, exactly one wins.
  claim_ends_at: string;
}

export const focusMutations = {
  logSession: async (input: LogFocusSessionInput): Promise<void> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";
    const { task_id, durationSeconds } = input;

    if (isGuest) {
      mockStore.addFocusLog({
        task_id,
        user_id: "guest",
        start_time: new Date(Date.now() - durationSeconds * 1000).toISOString(),
        end_time: new Date().toISOString(),
        duration_seconds: durationSeconds,
      });
      return;
    }

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase.from("focus_logs").insert({
      task_id,
      user_id: user.id,
      start_time: new Date(Date.now() - durationSeconds * 1000).toISOString(),
      end_time: new Date().toISOString(),
      duration_seconds: durationSeconds,
    });

    if (error) throw new Error(error.message);
  },

  upsertTimerState: async (input: UpsertTimerStateInput): Promise<void> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";
    const {
      user_id,
      mode,
      remaining_seconds,
      is_running,
      active_task_id,
      ends_at,
      source_device_id,
      completed_sessions,
      settings,
    } = input;

    if (isGuest) {
      return; // No-op for guest users
    }

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase.from("user_timer_state").upsert(
      {
        user_id,
        mode,
        remaining_seconds,
        is_running,
        active_task_id,
        ends_at,
        source_device_id,
        completed_sessions,
        settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) throw new Error(error.message);
  },

  /**
   * claimTimerCompletion — atomically complete a session.
   *
   * Writes the next state only if the DB row still shows the running session
   * being completed (matched by its deadline). Returns whether this device won
   * the claim. The loser (a second device finishing the same session) gets
   * `false` and must not fire completion side-effects — it mirrors the winner's
   * state via realtime instead. Guests always win (single device, no DB).
   */
  claimTimerCompletion: async (
    input: ClaimTimerCompletionInput,
  ): Promise<boolean> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";
    if (isGuest) return true;

    const {
      user_id,
      mode,
      remaining_seconds,
      is_running,
      active_task_id,
      ends_at,
      source_device_id,
      completed_sessions,
      settings,
      claim_ends_at,
    } = input;

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("user_timer_state")
      .update({
        mode,
        remaining_seconds,
        is_running,
        active_task_id,
        ends_at,
        source_device_id,
        completed_sessions,
        settings,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user_id)
      .eq("is_running", true)
      .eq("ends_at", claim_ends_at)
      .select("id");

    if (error) throw new Error(error.message);
    return (data?.length ?? 0) > 0;
  },
};
