"use client";

/**
 * Connect Calendar Dialog
 * Supports: CalDAV, Google OAuth, Outlook OAuth
 */

import React, { useState, useCallback } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { DialogTrigger } from "@/components/ui/dialog";
import { DrawerTrigger } from "@/components/ui/drawer";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CalendarSync,
  Network,
  CheckCircle2,
  Trash2,
  Loader2,
  Calendars,
} from "lucide-react";
import {
  CalendarProvider,
  CALDAV_PROVIDERS,
  DiscoveredCalendar,
} from "@/lib/types/external-calendar";
import { cn } from "@/lib/utils";
import { discoverCalendars } from "@/lib/caldav/client";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useConnectedCalendarProviders,
  useDisconnectCalendarProvider,
} from "@/lib/hooks/useConnectedCalendarProviders";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const CALDAV_STORAGE_KEY = "kanso_caldav_credentials";

interface ConnectCalendarDialogProps {
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function ConnectCalendarDialog({
  onSuccess,
  trigger,
}: ConnectCalendarDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<
    "select" | "configure_caldav" | "pick_calendars"
  >("select");
  const { data: connectedProviders = [] } = useConnectedCalendarProviders();
  const disconnect = useDisconnectCalendarProvider();
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] =
    useState<CalendarProvider | null>(null);

  // Calendar picker (OAuth providers)
  const [pickerCalendars, setPickerCalendars] = useState<DiscoveredCalendar[]>([]);
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSaving, setPickerSaving] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const openCalendarPicker = useCallback(async (provider: CalendarProvider) => {
    setSelectedProvider(provider);
    setStep("pick_calendars");
    setPickerLoading(true);
    setPickerError(null);
    setPickerCalendars([]);
    try {
      const [discoverRes, configuredRes] = await Promise.all([
        fetch(`/api/calendar/discover?provider=${provider}`),
        fetch(`/api/calendar/calendars`),
      ]);
      if (!discoverRes.ok) {
        const { error } = await discoverRes.json().catch(() => ({ error: "" }));
        throw new Error(error || "Failed to list calendars");
      }
      const { calendars } = await discoverRes.json();
      const { calendars: configured = [] } = configuredRes.ok
        ? await configuredRes.json()
        : { calendars: [] };
      const alreadyAdded = new Set(
        configured
          .filter((c: { provider: string }) => c.provider === provider)
          .map((c: { remote_calendar_id: string }) => c.remote_calendar_id),
      );
      setPickerCalendars(calendars);
      setPickerSelected(alreadyAdded as Set<string>);
    } catch (e) {
      setPickerError(e instanceof Error ? e.message : "Failed to list calendars");
    } finally {
      setPickerLoading(false);
    }
  }, []);

  const togglePick = (id: string) => {
    setPickerSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveCalendarPicks = async () => {
    if (!selectedProvider) return;
    setPickerSaving(true);
    try {
      const picks = pickerCalendars
        .filter((c) => pickerSelected.has(c.url))
        .map((c) => ({
          remote_calendar_id: c.url,
          name: c.displayName,
          color: c.color,
        }));
      const res = await fetch(`/api/calendar/calendars`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider, calendars: picks }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "" }));
        throw new Error(error || "Failed to save");
      }
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("Calendars saved — run Sync to pull events");
      setOpen(false);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save calendars");
    } finally {
      setPickerSaving(false);
    }
  };

  // CalDAV Configuration Form
  const [caldavForm, setCaldavForm] = useState({
    server_url: "",
    username: "",
    password: "",
    name: "My Calendar",
  });

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discoveredCount, setDiscoveredCount] = useState<number | null>(null);

  // Load stored credentials when the dialog opens
  React.useEffect(() => {
    if (open && typeof window !== "undefined") {
      const stored = localStorage.getItem(CALDAV_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setCaldavForm((f) => ({
            ...f,
            server_url: parsed.server_url || "",
            username: parsed.username || "",
            password: parsed.password || "",
          }));
        } catch {
          console.error("Failed to parse stored CalDAV credentials");
        }
      }
    }
  }, [open]);

  // Resume after OAuth redirect: /calendar?connected=:provider → open the dialog
  // straight at the calendar picker so there's no "did it connect?" gap.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    if (!connected || CALDAV_PROVIDERS.includes(connected as CalendarProvider)) return;

    const name = connected.charAt(0).toUpperCase() + connected.slice(1);
    toast.success(`${name} Calendar connected`);
    // Refresh the connected-providers list so the "Connected" section is ready
    queryClient.invalidateQueries({ queryKey: ["calendar-connected-providers"] });
    window.history.replaceState({}, "", "/calendar");
    setOpen(true);
    openCalendarPicker(connected as CalendarProvider);
  }, [openCalendarPicker, queryClient]);

  const clearStoredCredentials = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(CALDAV_STORAGE_KEY);
      setCaldavForm({
        server_url: "",
        username: "",
        password: "",
        name: "My Calendar",
      });
      setError(null);
      setDiscoveredCount(null);
    }
  };

  const resetDialog = () => {
    setStep("select");
    setSelectedProvider(null);
    setError(null);
    setDiscoveredCount(null);
    setPickerCalendars([]);
    setPickerSelected(new Set());
    setPickerError(null);
    setCaldavForm({
      server_url: "",
      username: "",
      password: "",
      name: "My Calendar",
    });
  };

  const handleProviderSelect = (provider: CalendarProvider) => {
    setSelectedProvider(provider);
    if (CALDAV_PROVIDERS.includes(provider)) {
      setStep("configure_caldav");
      if (provider === "icloud")
        setCaldavForm((f) => ({
          ...f,
          server_url: "https://caldav.icloud.com",
        }));
      if (provider === "fastmail")
        setCaldavForm((f) => ({
          ...f,
          server_url: "https://caldav.fastmail.com",
        }));
    } else {
      // Google / Outlook — redirect to server-side OAuth initiation
      window.location.href = `/api/calendar/connect/${provider}`;
    }
  };

  const handleCaldavConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    setError(null);
    setDiscoveredCount(null);

    try {
      const calendars = await discoverCalendars({
        serverUrl: caldavForm.server_url,
        username: caldavForm.username,
        password: caldavForm.password,
      });

      // Save credentials locally upon successful connection
      if (typeof window !== "undefined") {
        localStorage.setItem(CALDAV_STORAGE_KEY, JSON.stringify(caldavForm));
      }

      setDiscoveredCount(calendars.length);
      // Give the user 1.5s to read the success state then close
      setTimeout(() => {
        setOpen(false);
        onSuccess?.();
      }, 1500);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to connect to CalDAV server",
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const isMobile = useMediaQuery("(max-width: 640px)");
  const Trigger = isMobile ? DrawerTrigger : DialogTrigger;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(val) => {
        setOpen(val);
        if (!val) resetDialog();
      }}
    >
      <Trigger asChild>
        {trigger || (
          <Button
            variant="outline"
            className={cn("gap-2", "w-10 px-0 md:w-auto md:px-4")}
          >
            <CalendarSync className="w-4 h-4" />
            <span className="hidden md:inline">Connect Calendar</span>
          </Button>
        )}
      </Trigger>

      <ResponsiveDialogContent className="sm:max-w-lg p-0 overflow-hidden rounded-t-[20px] sm:rounded-xl">
        <ResponsiveDialogHeader className="px-4 pt-6 sm:px-6 text-left">
          <ResponsiveDialogTitle className="text-xl font-semibold tracking-tight capitalize">
            {step === "select" && "Connect Calendar"}
            {step === "configure_caldav" && `Configure ${selectedProvider}`}
            {step === "pick_calendars" && `${selectedProvider} Calendars`}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-sm text-muted-foreground/80">
            {step === "select" && "Sync your events from external providers."}
            {step === "configure_caldav" &&
              "Enter your server details and app-specific password."}
            {step === "pick_calendars" &&
              "Choose which calendars to sync with Kanso."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {step === "select" && connectedProviders.length > 0 && (
          <div className="px-4 pt-4 sm:px-6 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Connected</p>
            {connectedProviders.map((p) => (
              <div key={p} className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" strokeWidth={2.25} />
                  <span className="text-sm font-medium capitalize">{p}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                    title={`Choose ${p} calendars`}
                    onClick={() => openCalendarPicker(p as CalendarProvider)}
                  >
                    <Calendars className="w-3.5 h-3.5" strokeWidth={2.25} />
                    Calendars
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title={`Disconnect ${p}`}
                    onClick={async () => {
                      await disconnect(p);
                      toast.success(`${p.charAt(0).toUpperCase() + p.slice(1)} disconnected`);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={2.25} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {step === "select" && (
          <div className="grid grid-cols-2 gap-4 px-4 py-6 sm:px-6">
            <ProviderButton
              name="Google"
              icon={
                <svg viewBox="0 0 24 24" className="w-full h-full">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              }
              onClick={() => handleProviderSelect("google")}
            />
            <ProviderButton
              name="Outlook"
              icon={
                <svg viewBox="0 0 24 24" className="w-full h-full">
                  <path
                    d="M11.4 12L0 12V0l11.4 0v12zM0 24l11.4 0V12.6L0 12.6V24zM12.6 0v11.4L24 11.4V0H12.6zM12.6 24H24V12.6l-11.4 0V24z"
                    fill="#0078D4"
                  />
                </svg>
              }
              onClick={() => handleProviderSelect("outlook")}
            />
            <ProviderButton
              name="iCloud"
              icon={
                <svg
                  viewBox="0 0 17 20"
                  className="w-full h-full fill-current text-[#000] dark:text-white"
                >
                  <path d="M15.035 15.353c-.767 1.118-1.586 2.227-2.73 2.247-1.127.02-1.492-.663-2.783-.663-1.29 0-1.693.642-2.762.682-1.11.04-2.016-1.198-2.788-2.316-1.58-2.288-2.787-6.452-1.154-9.284.811-1.406 2.254-2.296 3.824-2.319 1.192-.018 2.316.804 3.045.804.722 0 2.071-.986 3.493-.843 1.455.059 2.115.545 2.62 1.284-3.134 1.84-2.636 5.922.563 7.25-.632 1.564-1.42 3.123-2.328 4.158zm-3.109-12.898c.636-.77 1.05-1.847.933-2.455-.514.022-1.137.345-1.505.77-.33.38-.633.882-.556 1.428.57.043 1.128-.312 1.128-.312z"></path>
                </svg>
              }
              onClick={() => handleProviderSelect("icloud")}
            />
            <ProviderButton
              name="CalDAV"
              subtitle="Nextcloud, etc."
              icon={<Network className="text-muted-foreground" />}
              onClick={() => handleProviderSelect("caldav")}
            />
          </div>
        )}

        {step === "configure_caldav" && (
          <form
            onSubmit={handleCaldavConnect}
            className="space-y-4 px-4 py-6 sm:px-6"
          >
            <div className="space-y-2">
              <Label htmlFor="server_url">Server URL</Label>
              <Input
                id="server_url"
                placeholder="https://caldav.example.com"
                value={caldavForm.server_url}
                onChange={(e) =>
                  setCaldavForm((f) => ({ ...f, server_url: e.target.value }))
                }
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username / Email</Label>
                <Input
                  id="username"
                  placeholder="user@example.com"
                  value={caldavForm.username}
                  onChange={(e) =>
                    setCaldavForm((f) => ({ ...f, username: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">App Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={caldavForm.password}
                  onChange={(e) =>
                    setCaldavForm((f) => ({ ...f, password: e.target.value }))
                  }
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Calendar Name (Local)</Label>
              <Input
                id="name"
                value={caldavForm.name}
                onChange={(e) =>
                  setCaldavForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {discoveredCount !== null && (
              <p className="text-sm text-green-600 dark:text-green-400">
                ✓ Connected —{" "}
                {discoveredCount === 0
                  ? "no calendars found yet (server is reachable)"
                  : `${discoveredCount} calendar${discoveredCount === 1 ? "" : "s"} discovered`}
              </p>
            )}

            <div className="flex justify-between items-center pt-4">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="hover:bg-accent/50"
                  onClick={() => setStep("select")}
                >
                  Back
                </Button>
                {(caldavForm.server_url || caldavForm.username) && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="h-9 w-9"
                    onClick={clearStoredCredentials}
                    title="Forget stored credentials"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Button
                type="submit"
                disabled={isConnecting || discoveredCount !== null}
                className="bg-brand text-white shadow-brand/10 hover:bg-brand/90"
              >
                {isConnecting
                  ? "Connecting..."
                  : discoveredCount !== null
                    ? "Connected ✓"
                    : "Connect Calendar"}
              </Button>
            </div>
          </form>
        )}

        {step === "pick_calendars" && (
          <div className="px-4 py-6 sm:px-6 space-y-4">
            {pickerLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading calendars…
              </div>
            ) : pickerError ? (
              <p className="text-sm text-destructive py-4">{pickerError}</p>
            ) : pickerCalendars.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No calendars found for this account.
              </p>
            ) : (
              <div className="space-y-1 max-h-[320px] overflow-y-auto">
                {pickerCalendars.map((cal) => (
                  <label
                    key={cal.url}
                    className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 px-3 py-2.5 cursor-pointer hover:bg-accent/30"
                  >
                    <Checkbox
                      checked={pickerSelected.has(cal.url)}
                      onCheckedChange={() => togglePick(cal.url)}
                    />
                    {cal.color && (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cal.color }}
                      />
                    )}
                    <span className="text-sm font-medium truncate">
                      {cal.displayName}
                    </span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <Button
                type="button"
                variant="ghost"
                className="hover:bg-accent/50"
                onClick={() => setStep("select")}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={pickerSaving || pickerLoading || pickerSelected.size === 0}
                onClick={saveCalendarPicks}
                className="bg-brand text-white shadow-brand/10 hover:bg-brand/90"
              >
                {pickerSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Saving…
                  </>
                ) : (
                  `Save ${pickerSelected.size || ""} calendar${pickerSelected.size === 1 ? "" : "s"}`.trim()
                )}
              </Button>
            </div>
          </div>
        )}

      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function ProviderButton({
  name,
  subtitle,
  icon,
  onClick,
}: {
  name: string;
  subtitle?: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center p-6 rounded-2xl border bg-card/50",
        "transition-all duration-300 ease-out",
        "hover:border-border/80 hover:bg-accent/30 hover:shadow-sm",
        "active:scale-[0.98] group relative",
      )}
    >
      <div className="mb-3 transition-transform duration-300 group-hover:scale-110">
        {React.cloneElement(
          icon as React.ReactElement<{ className?: string }>,
          {
            className: "w-8 h-8",
          },
        )}
      </div>
      <span className="text-sm font-semibold tracking-tight">{name}</span>
      {subtitle && (
        <span className="text-[10px] text-muted-foreground mt-0.5">
          {subtitle}
        </span>
      )}
    </button>
  );
}
