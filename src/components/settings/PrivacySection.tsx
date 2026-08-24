"use client";

import { ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { PrivacyPolicyLink } from "@/components/ui/privacy-policy-link";
import { useTelemetryConsent } from "@/lib/hooks/useTelemetryConsent";
import { useHaptic } from "@/lib/hooks/useHaptic";

export function PrivacySection() {
  const { consent, setConsent } = useTelemetryConsent();
  const { trigger } = useHaptic();

  const isEnabled = consent === "granted";

  const handleToggle = (checked: boolean) => {
    trigger("toggle");
    setConsent(checked ? "granted" : "denied");
  };

  return (
    <div className="space-y-4 p-4 rounded-lg border border-border/50 bg-background">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-secondary/30 shrink-0 mt-0.5">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium leading-none">
              Share Anonymous Telemetry
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Help improve Kagelin by sharing anonymous usage metrics (feature
              usage, timer durations, platform). Personal data, task titles, and
              notes are never collected or transmitted. See our{" "}
              <PrivacyPolicyLink />.
            </p>
          </div>
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={handleToggle}
          aria-label="Share Anonymous Telemetry"
          className="shrink-0 mt-0.5"
        />
      </div>
    </div>
  );
}
