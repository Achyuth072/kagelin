import { encryptPayload } from "@/lib/supabase/wrapClient";
import type {
  CalendarProvider,
  DiscoveredCalendar,
} from "@/lib/types/external-calendar";

// Pre-encrypts name because API route service-role writes bypass client encryption.
export async function connectCalendars(
  provider: CalendarProvider,
  picked: DiscoveredCalendar[],
): Promise<void> {
  const calendars = await Promise.all(
    picked.map(async (calendar) => {
      const id = crypto.randomUUID();
      const { name } = (await encryptPayload("external_calendars", {
        id,
        name: calendar.displayName,
      })) as { name: string };
      return {
        id,
        remote_calendar_id: calendar.url,
        name,
        color: calendar.color,
      };
    }),
  );

  const res = await fetch("/api/calendar/calendars", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, calendars }),
  });

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "" }));
    throw new Error(error || "Failed to save");
  }
}
