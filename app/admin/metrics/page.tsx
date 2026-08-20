import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAdminMetricsSummary } from "@/lib/admin/metricsQueries";
import { MetricsDashboard } from "@/components/admin/MetricsDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Metrics — Kagelin",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminMetricsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    notFound();
  }

  const rawAdminEmails = process.env.ADMIN_EMAILS ?? "";
  const adminEmails = rawAdminEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const userEmail = user.email.trim().toLowerCase();

  if (!adminEmails.includes(userEmail)) {
    notFound();
  }

  const summary = await getAdminMetricsSummary();

  return <MetricsDashboard summary={summary} adminEmail={user.email} />;
}
