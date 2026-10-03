import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  composeBriefing,
  type BriefingInput,
} from "../_shared/compose-briefing.ts";
import { toErrorMessage } from "../_shared/errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: morningUsers, error: morningError } = await supabaseAdmin.rpc(
      "get_users_for_morning_briefing",
    );
    const { data: eveningUsers, error: eveningError } = await supabaseAdmin.rpc(
      "get_users_for_evening_plan",
    );

    if (morningError)
      console.error("Morning Briefing RPC error:", morningError);
    if (eveningError) console.error("Evening Plan RPC error:", eveningError);

    const results = { morning_scheduled: 0, evening_scheduled: 0 };
    const failures: unknown[] = [];

    const schedule = async (
      kind: "morning" | "evening",
      users: Array<{ id: string }> | null,
      settingKey: "morning_briefing" | "evening_plan",
      queueType: "briefing" | "evening",
    ) => {
      for (const user of users ?? []) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("settings")
          .eq("id", user.id)
          .single();

        if (!(profile?.settings?.notifications?.[settingKey] ?? true)) continue;

        const { data: facts, error: factsError } = await supabaseAdmin.rpc(
          "get_briefing_facts",
          { p_user_id: user.id, p_kind: kind },
        );
        if (factsError) {
          failures.push(factsError);
          continue;
        }
        if (!facts) continue;

        const brief = composeBriefing({
          kind,
          counts: facts.counts,
          nextUp: facts.nextUp,
        } as BriefingInput);
        if (!brief) continue;

        await supabaseAdmin.from("notification_queue").insert({
          user_id: user.id,
          type: queueType,
          scheduled_at: new Date().toISOString(),
          payload: brief,
        });
        results[`${kind}_scheduled`]++;
      }
    };

    await schedule("morning", morningUsers, "morning_briefing", "briefing");
    await schedule("evening", eveningUsers, "evening_plan", "evening");

    if (failures.length > 0) {
      throw new Error(
        `get_briefing_facts failed for ${failures.length} user(s): ${failures.map(toErrorMessage).join("; ")}`,
      );
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Critical error in daily-briefing:", error);
    return new Response(JSON.stringify({ error: toErrorMessage(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
