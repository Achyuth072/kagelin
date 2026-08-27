import { RuleTester } from "eslint";
import rule from "../../../eslint-rules/no-unbounded-supabase-select.mjs";

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: "latest", sourceType: "module" },
});

ruleTester.run("no-unbounded-supabase-select", rule, {
  valid: [
    // Paged through fetchAllRows — the sanctioned way to read a whole table.
    `await fetchAllRows((from, to) =>
       supabase.from("tasks").select("*").order("id").range(from, to));`,
    // The multi-statement builder shape useTasks.ts uses, bounded.
    `await fetchAllRows((from, to) => {
       let query = supabase.from("tasks").select("*").is("parent_id", null);
       if (filter === "today") query = query.lte("due_date", end);
       return query.range(from, to);
     });`,
    // Single-row reads can't be capped.
    `await supabase.from("tasks").select("*").eq("id", id).single();`,
    `await supabase.from("projects").select("*").eq("is_inbox", true).maybeSingle();`,
    // Explicitly capped.
    `await supabase.from("tasks").select("*").limit(50);`,
    `await supabase.from("focus_logs").select("*").gte("start_time", t).range(0, 99);`,
    // head: true returns a count, no rows.
    `await supabase.from("tasks").select("*", { head: true, count: "exact" });`,
    // Bounded by a later statement rather than inline.
    `let query = supabase.from("tasks").select("*");
     if (projectId) query = query.eq("project_id", projectId);
     query = query.limit(100);
     const { data } = await query;`,
    // Handed to a helper — whatever bound it needs is that helper's business.
    `function load() {
       const query = supabase.from("tasks").select("*");
       return runPaged(query);
     }`,
    // Not a Supabase read.
    `d3.select("body").append("svg");`,
    // select() after a write returns only the rows that write touched.
    `await supabase.from("tasks").update({ is_completed: true }).eq("id", id).select();`,
  ],
  invalid: [
    {
      code: `const { data, error } = await supabase
               .from("tasks")
               .select("is_completed, completed_at")
               .eq("user_id", userId);`,
      errors: [{ messageId: "unbounded", data: { table: '"tasks"' } }],
    },
    {
      // The exact shape that broke the Stats page.
      code: `const { data } = await supabase
               .from("focus_logs")
               .select("start_time, duration_seconds");`,
      errors: [{ messageId: "unbounded", data: { table: '"focus_logs"' } }],
    },
    {
      // Multi-statement builder, never terminated.
      code: `let query = supabase.from("tasks").select("*").is("parent_id", null);
             if (filter === "today") query = query.lte("due_date", end);
             if (!showCompleted) query = query.or("is_completed.eq.false");
             const { data, error } = await query;`,
      errors: [{ messageId: "unbounded", data: { table: '"tasks"' } }],
    },
    {
      // count without head still streams rows back.
      code: `await supabase.from("calendar_events").select("*", { count: "exact" }).eq("is_archived", false);`,
      errors: [
        { messageId: "unbounded", data: { table: '"calendar_events"' } },
      ],
    },
  ],
});
