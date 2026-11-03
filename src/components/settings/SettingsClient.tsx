"use client";

import { useRef, useState, useId } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/AuthProvider";
import { useActiveBanner } from "@/components/bannerSlot";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoaderOverlay } from "@/components/ui/loader-overlay";
import {
  ArrowLeft,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Clock,
  HardDrive,
  Info,
  KeyRound,
  LogOut,
  Palette,
  RotateCcw,
  Shield,
  Sliders,
  Target,
  Trash2,
  User,
  UserCheck,
  Vibrate,
  Bell,
  Sun,
  Moon,
  Monitor,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useUiStore, type GoalsState } from "@/lib/store/uiStore";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useAnchoredBack } from "@/lib/hooks/useBackAnchor";
import { useQueryClient } from "@tanstack/react-query";
import {
  useClearGuestData,
  useResetDemoData,
} from "@/lib/hooks/useGuestStoreActions";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { PwaInstallRow } from "@/components/settings/PwaInstallRow";
import { ShortcutTipsRow } from "@/components/settings/ShortcutTipsRow";
import { DeleteUserDataDialog } from "@/components/settings/DeleteUserDataDialog";
import { BackupSyncSettings } from "@/components/settings/BackupSyncSettings";
import { AccountSection } from "@/components/settings/AccountSection";
import { EncryptionSection } from "@/components/settings/EncryptionSection";
import { PrivacySection } from "@/components/settings/PrivacySection";
import { DiagnosticExportSettings } from "@/components/settings/DiagnosticExportSettings";
import { useAccountData } from "@/lib/hooks/useAccountData";
import { useProfile } from "@/lib/hooks/useProfile";
import { ChangelogPopup } from "@/components/ui/ChangelogPopup";
import { AboutSheet } from "@/components/settings/AboutSheet";
import { PreviewBadge } from "@/components/ui/PreviewBadge";
import { SettingsContextRail } from "@/components/settings/SettingsContextRail";

const SignOutConfirmation = dynamic(
  () =>
    import("@/components/auth/SignOutConfirmation").then(
      (mod) => mod.SignOutConfirmation,
    ),
  { ssr: false },
);

type SettingsTab = "appearance" | "preferences" | "account";

interface NavTabItem {
  value: SettingsTab;
  label: string;
  description: string;
  icon: LucideIcon;
}

const navSectionTabs: NavTabItem[] = [
  {
    value: "appearance",
    label: "Appearance",
    description: "Theme & visual styling",
    icon: Palette,
  },
  {
    value: "preferences",
    label: "Preferences",
    description: "Habits, goals & alerts",
    icon: Sliders,
  },
  {
    value: "account",
    label: "Account",
    description: "Profile, security & data",
    icon: UserCheck,
  },
];

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const PREFERENCE_SECTION_KEYS = [
  "interface",
  "notifications",
  "goals",
  "system",
] as const;

const ACCOUNT_SECTION_KEYS = [
  "profile",
  "security",
  "backup",
  "danger",
] as const;

const TIME_FORMAT_OPTIONS = ["12h", "24h", "system"] as const;

const SECTION_MAX_WIDTH = "max-w-4xl";

function getNextRovingIndex(
  key: string,
  currentIndex: number,
  total: number,
  allowHomeEnd = false,
): number {
  if (key === "ArrowDown" || key === "ArrowRight") {
    return (currentIndex + 1) % total;
  }
  if (key === "ArrowUp" || key === "ArrowLeft") {
    return (currentIndex - 1 + total) % total;
  }
  if (allowHomeEnd && key === "Home") {
    return 0;
  }
  if (allowHomeEnd && key === "End") {
    return total - 1;
  }
  return -1;
}

function CollapsibleSection({
  title,
  icon: Icon,
  summary,
  isOpen,
  onToggle,
  children,
  isDanger = false,
}: {
  title: string;
  icon: LucideIcon;
  summary: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  isDanger?: boolean;
}) {
  const sectionId = useId();
  const headerId = `accordion-header-${sectionId}`;
  const panelId = `accordion-panel-${sectionId}`;

  return (
    <div
      className={cn(
        "rounded-lg border transition-all duration-150 overflow-hidden",
        isOpen
          ? "bg-card border-border shadow-xs"
          : "bg-card border-border/70 hover:border-border",
        isDanger &&
          (isOpen
            ? "border-destructive/50"
            : "border-destructive/40 hover:border-destructive/60"),
      )}
    >
      <h3 className="m-0 p-0 text-sm font-medium">
        <button
          type="button"
          id={headerId}
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="w-full flex items-center justify-between p-3.5 md:py-2.5 md:px-3.5 min-h-[44px] md:min-h-[40px] text-left select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                "p-1.5 rounded-md shrink-0",
                isDanger
                  ? "bg-secondary/40 text-destructive"
                  : "bg-secondary/50 text-muted-foreground",
              )}
              aria-hidden="true"
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span
                className={cn(
                  "text-sm font-medium leading-tight truncate block",
                  isDanger &&
                    "text-destructive font-semibold uppercase tracking-wider type-ui",
                )}
              >
                {title}
              </span>
              <p className="type-micro text-muted-foreground truncate mt-0.5">
                {summary}
              </p>
            </div>
          </div>

          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 ml-3 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
      </h3>

      {isOpen && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headerId}
          className="p-3.5 md:p-4 pt-2 border-t border-border/40 animate-in fade-in-50 duration-150"
        >
          {children}
        </div>
      )}
    </div>
  );
}

function AccountInfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center p-3 md:py-2.5 md:px-3 min-h-[44px] md:min-h-[38px] rounded-lg border border-border/80 bg-background">
      <div className="flex items-center gap-3">
        <div className="p-1.5 rounded-full bg-secondary/30">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="type-micro text-muted-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

interface GoalFieldProps {
  label: string;
  value: GoalsState[keyof GoalsState];
  unit?: string;
  onCommit: (value: number | null) => void;
}

function GoalField({ label, value, unit, onCommit }: GoalFieldProps) {
  const inputId = useId();
  const descId = `desc-${inputId}`;
  const [text, setText] = useState(value != null ? String(value) : "");
  const [prevValue, setPrevValue] = useState(value);

  if (value !== prevValue) {
    setPrevValue(value);
    setText(value != null ? String(value) : "");
  }

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed === "") {
      onCommit(null);
      return;
    }
    const parsed = Number(trimmed);
    onCommit(Number.isFinite(parsed) && parsed >= 0 ? parsed : null);
  };

  return (
    <div className="flex items-center justify-between gap-4 min-h-[44px] md:min-h-[36px] py-1">
      <label htmlFor={inputId} className="text-sm text-foreground">
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <Input
          id={inputId}
          aria-describedby={unit ? descId : undefined}
          type="number"
          min={0}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit();
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Off"
          className="w-24 h-9 md:h-8 text-right text-base md:text-sm"
        />
        {unit && (
          <span id={descId} className="sr-only">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

interface SettingsClientProps {
  version: string;
}

export function SettingsClient({ version }: SettingsClientProps) {
  const { theme, setTheme } = useTheme();
  const hapticsEnabled = useUiStore((state) => state.hapticsEnabled);
  const setHapticsEnabled = useUiStore((state) => state.setHapticsEnabled);
  const timeFormat = useUiStore((state) => state.timeFormat);
  const setTimeFormat = useUiStore((state) => state.setTimeFormat);
  const goals = useUiStore((state) => state.goals);
  const setGoals = useUiStore((state) => state.setGoals);
  const { user, signOut, signOutAllDevices, isGuestMode } = useAuth();
  const hasTopBanner = useActiveBanner() !== null;
  const router = useRouter();
  const anchoredBack = useAnchoredBack();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const clearGuestData = useClearGuestData();
  const resetDemoData = useResetDemoData();
  const { trigger } = useHaptic();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const mainRef = useRef<HTMLElement>(null);

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showSignOutAllConfirm, setShowSignOutAllConfirm] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const tab = searchParams.get("tab");
    if (tab === "goals" || tab === "preferences") return "preferences";
    if (tab === "account") return "account";
    return "appearance";
  });

  const { clearCloudData } = useAccountData();
  const { profile } = useProfile({ enabled: activeTab === "account" });

  // Accordion state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    interface: true,
    notifications: false,
    goals: false,
    system: false,
    profile: true,
    security: false,
    backup: false,
    danger: false,
  });

  if (!user) {
    return <LoaderOverlay message="Signing out..." />;
  }

  const handleTabChange = (v: SettingsTab) => {
    trigger("toggle");
    setActiveTab(v);
    mainRef.current?.scrollTo(0, 0);
  };

  const toggleSection = (id: string) => {
    trigger("toggle");
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const activeKeys =
    activeTab === "preferences"
      ? PREFERENCE_SECTION_KEYS
      : ACCOUNT_SECTION_KEYS;

  const isAllExpanded = activeKeys.every((k) => openSections[k]);

  const toggleAll = () => {
    trigger("thud");
    const nextState = !isAllExpanded;
    setOpenSections((prev) => {
      const updated = { ...prev };
      for (const k of activeKeys) {
        updated[k] = nextState;
      }
      return updated;
    });
  };

  const handleSignOut = async (allDevices: boolean) => {
    setShowSignOutConfirm(false);
    setShowSignOutAllConfirm(false);
    setIsSigningOut(true);
    if (allDevices) {
      const { error } = await signOutAllDevices();
      if (error) {
        setIsSigningOut(false);
        notify.error("Couldn't sign out of all devices", {
          description: error.message,
        });
        return;
      }
    } else {
      await signOut();
    }
    router.push("/login");
  };

  const handleClearData = async () => {
    if (!isGuestMode) {
      await clearCloudData();
      await queryClient.invalidateQueries();
      return;
    }
    clearGuestData();
  };

  const activeGoalsCount = [
    goals.dailyFocusHours,
    goals.weeklyFocusHours,
    goals.dailyTasksCompleted,
    goals.weeklyTasksCompleted,
  ].filter((g) => g != null).length;

  const handleNavKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    const targetIndex = getNextRovingIndex(
      e.key,
      currentIndex,
      navSectionTabs.length,
      true,
    );
    if (targetIndex >= 0) {
      e.preventDefault();
      handleTabChange(navSectionTabs[targetIndex].value);
      document
        .getElementById(`settings-tab-${navSectionTabs[targetIndex].value}`)
        ?.focus();
    }
  };

  const handleThemeKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    const targetIndex = getNextRovingIndex(
      e.key,
      currentIndex,
      themeOptions.length,
    );
    if (targetIndex >= 0) {
      e.preventDefault();
      trigger("toggle");
      setTheme(themeOptions[targetIndex].value);
      document
        .getElementById(`theme-option-${themeOptions[targetIndex].value}`)
        ?.focus();
    }
  };

  const handleTimeFormatKeyDown = (
    e: React.KeyboardEvent,
    currentIndex: number,
  ) => {
    const targetIndex = getNextRovingIndex(
      e.key,
      currentIndex,
      TIME_FORMAT_OPTIONS.length,
    );
    if (targetIndex >= 0) {
      e.preventDefault();
      trigger("toggle");
      setTimeFormat(TIME_FORMAT_OPTIONS[targetIndex]);
      document
        .getElementById(
          `time-format-option-${TIME_FORMAT_OPTIONS[targetIndex]}`,
        )
        ?.focus();
    }
  };

  const renderNavTabs = () => (
    <nav
      className="flex flex-col gap-1.5 w-full"
      aria-label="Settings navigation"
    >
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label="Settings navigation"
        className="flex flex-col gap-1.5 w-full"
      >
        {navSectionTabs.map((tab, idx) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              id={`settings-tab-${tab.value}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`settings-tabpanel-${tab.value}`}
              tabIndex={isActive ? 0 : -1}
              onKeyDown={(e) => handleNavKeyDown(e, idx)}
              type="button"
              onClick={() => handleTabChange(tab.value)}
              className={cn(
                "flex items-center gap-3 p-2.5 rounded-lg border text-left transition-seijaku-fast relative min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-card border-border/80 text-foreground font-medium shadow-xs"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/30 hover:border-border/40",
              )}
            >
              <div
                className={cn(
                  "p-1.5 rounded-md shrink-0 transition-colors border",
                  isActive
                    ? "bg-secondary/80 text-brand border-border/50"
                    : "bg-secondary/30 text-muted-foreground border-transparent",
                )}
                aria-hidden="true"
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-none">{tab.label}</p>
                <p className="type-micro text-muted-foreground/80 mt-1 truncate">
                  {tab.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );

  const renderTabContent = () => (
    <>
      {/* TAB 1: APPEARANCE */}
      {activeTab === "appearance" && (
        <section
          className={cn(
            "animate-in fade-in-50 duration-150 space-y-4",
            SECTION_MAX_WIDTH,
          )}
        >
          <div>
            <h2 className="type-h3">Appearance</h2>
            <p className="type-ui text-muted-foreground mt-0.5">
              Select your preferred interface color theme
            </p>
          </div>
          <div
            className="grid grid-cols-3 gap-3 pt-1"
            role="radiogroup"
            aria-label="Theme mode"
          >
            {themeOptions.map((option, idx) => {
              const Icon = option.icon;
              const isActive = theme === option.value;
              return (
                <button
                  key={option.value}
                  id={`theme-option-${option.value}`}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onKeyDown={(e) => handleThemeKeyDown(e, idx)}
                  onClick={() => {
                    trigger("toggle");
                    setTheme(option.value);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 md:py-2.5 md:px-3 rounded-lg border-2 transition-seijaku-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] md:min-h-0",
                    isActive
                      ? "border-brand bg-secondary/30"
                      : "border-border/60 hover:border-border/80 bg-background",
                  )}
                >
                  <Icon
                    className="h-4 w-4 md:h-4.5 md:w-4.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span
                    className={cn(
                      "text-xs md:text-sm font-medium",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 2: PREFERENCES (ACCORDIONS) */}
      {activeTab === "preferences" && (
        <div className="animate-in fade-in-50 duration-150 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-1">
            <div>
              <h2 className="type-h3">Preferences</h2>
              <p className="type-ui text-muted-foreground mt-0.5">
                Customize habits, timers, notifications, and telemetry
              </p>
            </div>
            <div className="flex items-center self-end sm:self-auto shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5 border border-border/40 bg-secondary/10"
                onClick={toggleAll}
              >
                {isAllExpanded ? (
                  <>
                    <ChevronsDownUp className="h-3.5 w-3.5" />
                    <span>Collapse all</span>
                  </>
                ) : (
                  <>
                    <ChevronsUpDown className="h-3.5 w-3.5" />
                    <span>Expand all</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* 1. Interface & Display */}
          <CollapsibleSection
            title="Interface & Display"
            icon={Sliders}
            summary={`${timeFormat.toUpperCase()} clock • ${hapticsEnabled ? "Haptics on" : "Haptics off"}`}
            isOpen={!!openSections.interface}
            onToggle={() => toggleSection("interface")}
          >
            <div className="space-y-3 pt-1">
              {!isDesktop && (
                <div className="flex items-center justify-between p-3 min-h-[44px] rounded-lg border border-border/60 bg-background">
                  <div className="flex items-center gap-3">
                    <Vibrate className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Haptic Feedback</p>
                      <p className="type-micro text-muted-foreground">
                        Tactile vibration when interacting with controls
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={hapticsEnabled}
                    onCheckedChange={setHapticsEnabled}
                    aria-label="Haptic Feedback"
                  />
                </div>
              )}

              <div className="space-y-2.5 p-3 md:py-2.5 md:px-3 rounded-lg border border-border/60 bg-background">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Time Format</p>
                    <p className="type-micro text-muted-foreground">
                      Select 12-hour, 24-hour, or system default
                    </p>
                  </div>
                </div>
                <div
                  className="grid grid-cols-3 gap-2 pt-0.5"
                  role="radiogroup"
                  aria-label="Time Format"
                >
                  {TIME_FORMAT_OPTIONS.map((fmt, idx) => {
                    const isFmtActive = timeFormat === fmt;
                    return (
                      <button
                        key={fmt}
                        id={`time-format-option-${fmt}`}
                        type="button"
                        role="radio"
                        aria-checked={isFmtActive}
                        tabIndex={isFmtActive ? 0 : -1}
                        onKeyDown={(e) => handleTimeFormatKeyDown(e, idx)}
                        onClick={() => {
                          trigger("toggle");
                          setTimeFormat(fmt);
                        }}
                        className={cn(
                          "py-1.5 px-3 rounded-md text-xs font-mono font-medium border transition-seijaku-fast min-h-[38px] md:min-h-[32px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isFmtActive
                            ? "bg-brand text-brand-foreground border-brand"
                            : "border-border/60 text-muted-foreground hover:text-foreground bg-secondary/15",
                        )}
                      >
                        {fmt === "system" ? "System" : fmt.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isDesktop && <ShortcutTipsRow />}
            </div>
          </CollapsibleSection>

          {/* 2. Notifications & Alerts */}
          <CollapsibleSection
            title="Notifications & Alerts"
            icon={Bell}
            summary="Daily digests, inactivity nudges, lead time & quiet hours"
            isOpen={!!openSections.notifications}
            onToggle={() => toggleSection("notifications")}
          >
            <div className="pt-1">
              <NotificationSettings />
            </div>
          </CollapsibleSection>

          {/* 3. Goals & Target Rings */}
          <CollapsibleSection
            title="Goals & Target Rings"
            icon={Target}
            summary={`${activeGoalsCount} of 4 target rings active on Stats`}
            isOpen={!!openSections.goals}
            onToggle={() => toggleSection("goals")}
          >
            <div className="space-y-3 pt-1">
              <p className="type-micro text-muted-foreground">
                Set daily and weekly targets shown as progress rings on your
                Stats page. Leave blank to hide.
              </p>
              <div className="space-y-1 bg-background p-3 rounded-lg border border-border/60">
                <GoalField
                  label="Daily focus hours"
                  value={goals.dailyFocusHours}
                  unit="hours"
                  onCommit={(v) => setGoals({ dailyFocusHours: v })}
                />
                <GoalField
                  label="Weekly focus hours"
                  value={goals.weeklyFocusHours}
                  unit="hours"
                  onCommit={(v) => setGoals({ weeklyFocusHours: v })}
                />
                <GoalField
                  label="Daily tasks completed"
                  value={goals.dailyTasksCompleted}
                  unit="tasks"
                  onCommit={(v) => setGoals({ dailyTasksCompleted: v })}
                />
                <GoalField
                  label="Weekly tasks completed"
                  value={goals.weeklyTasksCompleted}
                  unit="tasks"
                  onCommit={(v) => setGoals({ weeklyTasksCompleted: v })}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* 4. System, Privacy & PWA */}
          <CollapsibleSection
            title="System, Privacy & PWA"
            icon={Shield}
            summary="Install app, error telemetry & diagnostic logs"
            isOpen={!!openSections.system}
            onToggle={() => toggleSection("system")}
          >
            <div className="space-y-3 pt-1">
              <PwaInstallRow />
              <PrivacySection />
              <DiagnosticExportSettings />
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* TAB 3: ACCOUNT */}
      {activeTab === "account" && (
        <div className="animate-in fade-in-50 duration-150 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-1">
            <div>
              <h2 className="type-h3">Account &amp; Security</h2>
              <p className="type-ui text-muted-foreground mt-0.5">
                Manage credentials, end-to-end keys, backups, and data
              </p>
            </div>
            <div className="flex items-center self-end sm:self-auto shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5 border border-border/40 bg-secondary/10"
                onClick={toggleAll}
              >
                {isAllExpanded ? (
                  <>
                    <ChevronsDownUp className="h-3.5 w-3.5" />
                    <span>Collapse all</span>
                  </>
                ) : (
                  <>
                    <ChevronsUpDown className="h-3.5 w-3.5" />
                    <span>Expand all</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Guest Mode Callout */}
          {isGuestMode && (
            <div className="p-4 rounded-xl border border-brand/40 bg-brand/10 dark:bg-brand/15 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="type-ui font-semibold text-foreground">
                    Guest Mode
                  </span>
                  <span className="type-micro font-mono px-2 py-0.5 rounded-full bg-brand text-brand-foreground font-semibold uppercase tracking-wider">
                    Local Only
                  </span>
                </div>
                <p className="type-ui text-foreground/85 leading-relaxed mt-1">
                  Your habits and tasks are saved directly in your browser. Sign
                  up or log in to sync seamlessly across devices.
                </p>
              </div>
              <Button
                className="w-full bg-brand hover:bg-brand/90 text-brand-foreground font-semibold shadow-xs h-10 md:h-9"
                onClick={() => {
                  trigger("toggle");
                  router.push("/signup");
                }}
              >
                <User className="h-4 w-4 mr-2" />
                <span>Sync to Account</span>
              </Button>
            </div>
          )}

          {/* 1. Profile & Identity */}
          <CollapsibleSection
            title="Profile & Identity"
            icon={User}
            summary={
              isGuestMode
                ? "Guest Session (Local Only)"
                : user?.email || "Signed In"
            }
            isOpen={!!openSections.profile}
            onToggle={() => toggleSection("profile")}
          >
            <div className="space-y-3 pt-1">
              {profile?.display_name &&
                profile.display_name !== user?.email && (
                  <AccountInfoRow
                    icon={User}
                    label="Name"
                    value={profile.display_name}
                  />
                )}
              <AccountInfoRow
                icon={User}
                label="Email"
                value={user?.email || "Guest user"}
              />
            </div>
          </CollapsibleSection>

          {/* 2. Security & Encryption (Registered only) */}
          {!isGuestMode && (
            <CollapsibleSection
              title="Security & Encryption"
              icon={KeyRound}
              summary="Password, recovery keys & client-side encryption"
              isOpen={!!openSections.security}
              onToggle={() => toggleSection("security")}
            >
              <div className="space-y-3 pt-1">
                <AccountSection />
                <EncryptionSection />
              </div>
            </CollapsibleSection>
          )}

          {/* 3. Backup & Data Portability */}
          <CollapsibleSection
            title="Backup & Data Portability"
            icon={HardDrive}
            summary="CalDAV sync, database snapshot & uhabits migration"
            isOpen={!!openSections.backup}
            onToggle={() => toggleSection("backup")}
          >
            <div className="pt-1">
              <BackupSyncSettings />
            </div>
          </CollapsibleSection>

          {/* 4. Danger Zone */}
          <CollapsibleSection
            title="Danger Zone"
            icon={Trash2}
            summary={
              isGuestMode
                ? "Reset demo data, clear local storage & exit"
                : "Delete cloud data & terminate account sessions"
            }
            isOpen={!!openSections.danger}
            onToggle={() => toggleSection("danger")}
            isDanger
          >
            <div className="space-y-3 pt-1">
              <p className="type-micro text-muted-foreground">
                These actions permanently remove data or terminate your active
                session. Proceed with care.
              </p>

              <div className="space-y-2">
                {isGuestMode ? (
                  <>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 justify-start shadow-none h-11 md:h-9 min-h-[44px] md:min-h-0 text-sm"
                        onClick={() => {
                          trigger("thud");
                          resetDemoData();
                        }}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        <span>Reset Demo Data</span>
                      </Button>

                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1 justify-start shadow-none h-11 md:h-9 min-h-[44px] md:min-h-0 text-sm"
                        onClick={() => {
                          trigger("thud");
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" strokeWidth={2.25} />
                        <span>Clear Local Data</span>
                      </Button>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start shadow-none h-11 md:h-9 min-h-[44px] md:min-h-0 text-sm"
                      onClick={() => {
                        trigger("thud");
                        handleSignOut(false);
                      }}
                      disabled={isSigningOut}
                    >
                      <LogOut className="h-4 w-4 mr-2 text-destructive" />
                      <span>Exit Guest Mode</span>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full justify-start shadow-none h-11 md:h-9 min-h-[44px] md:min-h-0 text-sm"
                      onClick={() => {
                        trigger("thud");
                        setIsDeleteDialogOpen(true);
                      }}
                      disabled={isSigningOut}
                    >
                      <Trash2 className="h-4 w-4 mr-2" strokeWidth={2.25} />
                      <span>Delete Cloud Data</span>
                    </Button>

                    <div className="flex flex-col sm:flex-row gap-2 pt-0.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 justify-start shadow-none h-11 md:h-9 min-h-[44px] md:min-h-0 text-sm"
                        onClick={() => {
                          trigger("thud");
                          setShowSignOutConfirm(true);
                        }}
                        disabled={isSigningOut}
                      >
                        <LogOut className="h-4 w-4 mr-2 text-destructive" />
                        <span>Sign Out</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 justify-start shadow-none text-destructive border-border/80 hover:border-destructive hover:bg-destructive-surface-hover transition-all h-11 md:h-9 min-h-[44px] md:min-h-0 text-sm"
                        onClick={() => {
                          trigger("thud");
                          setShowSignOutAllConfirm(true);
                        }}
                        disabled={isSigningOut}
                      >
                        <LogOut className="h-4 w-4 mr-2 text-destructive" />
                        <span>Sign Out All Devices</span>
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* About Footer */}
      <div
        className={cn(
          "pt-10 pb-12 transition-all duration-300",
          SECTION_MAX_WIDTH,
        )}
      >
        <div className="border-t border-border/40 w-16 mx-auto mb-6 opacity-50" />
        <button
          type="button"
          onClick={() => {
            trigger("toggle");
            setIsAboutOpen(true);
          }}
          className="group mx-auto flex flex-col items-center gap-1.5 min-h-[44px] md:min-h-0 min-w-[44px] p-2.5 rounded-lg transition-seijaku-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center gap-2">
            <span className="type-ui text-muted-foreground/80 group-hover:text-foreground transition-colors">
              Kagelin • v{version}
            </span>
            <PreviewBadge version={version} />
          </div>
          <span className="flex items-center gap-1.5 type-micro text-muted-foreground group-hover:text-foreground transition-colors uppercase font-medium">
            <Info className="h-3 w-3" />
            About
          </span>
        </button>
      </div>
    </>
  );

  return (
    <>
      <div
        className={cn(
          "flex flex-col p-4 md:p-6 gap-6 md:gap-8 relative overflow-hidden scrollbar-hide",
          hasTopBanner
            ? "h-[calc(100dvh-var(--offline-banner-height))]"
            : "h-dvh",
        )}
      >
        {/* Mobile Top Header */}
        <div className="md:hidden shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="ghost"
              size="icon"
              onPointerDown={() => trigger("toggle")}
              onClick={anchoredBack}
              className="h-10 w-10 min-h-[44px] min-w-[44px] md:h-9 md:w-9 md:min-h-0 md:min-w-0 shadow-none transition-seijaku-fast"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="type-h1">Settings</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account and preferences
          </p>
        </div>

        {/* Mobile Tab Bar */}
        <div className="md:hidden -mx-4 border-b border-border/60 bg-background px-4 py-2 shrink-0 z-10">
          <Tabs
            value={activeTab}
            onValueChange={(v) => handleTabChange(v as SettingsTab)}
            className="w-full"
          >
            <TabsList
              variant="card"
              size="lg"
              className="grid grid-cols-3 w-full"
              aria-label="Settings sections"
            >
              {navSectionTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    id={`settings-mobile-tab-${tab.value}`}
                    aria-controls={`settings-tabpanel-${tab.value}`}
                    className="h-full px-2"
                  >
                    <Icon aria-hidden="true" />
                    <span className="truncate">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:block">
          <h1 className="type-h1 mb-1">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your account and preferences
          </p>
        </div>

        {/* 3-Column Contextual Rail Layout */}
        <div className="flex flex-col md:flex-row gap-8 md:gap-10 w-full flex-1 min-h-0 justify-start">
          {/* Desktop Sidebar */}
          <aside className="hidden md:block w-60 shrink-0 sticky top-6 self-start">
            {renderNavTabs()}
          </aside>

          <Separator
            orientation="vertical"
            className="hidden md:block self-stretch bg-brand/20 shrink-0"
          />

          {/* Main Content Area */}
          <main
            ref={mainRef}
            id={`settings-tabpanel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={
              isDesktop
                ? `settings-tab-${activeTab}`
                : `settings-mobile-tab-${activeTab}`
            }
            tabIndex={0}
            className="space-y-6 flex flex-col flex-1 min-w-0 min-h-0 max-w-3xl w-full overflow-y-auto scrollbar-hide safe-bottom focus-visible:outline-none"
          >
            {renderTabContent()}
          </main>

          {/* Contextual Rail (Preferences & Account only) */}
          {activeTab !== "appearance" && (
            <SettingsContextRail
              activeTab={activeTab}
              isGuestMode={isGuestMode}
              userEmail={user?.email}
              goals={goals}
              onOpenSection={(sectionId) => {
                setOpenSections((prev) => ({ ...prev, [sectionId]: true }));
              }}
            />
          )}
        </div>
      </div>

      <SignOutConfirmation
        isOpen={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={() => handleSignOut(false)}
      />

      <SignOutConfirmation
        isOpen={showSignOutAllConfirm}
        onClose={() => setShowSignOutAllConfirm(false)}
        onConfirm={() => handleSignOut(true)}
        allDevices
      />

      <DeleteUserDataDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleClearData}
      />

      <ChangelogPopup
        open={isChangelogOpen}
        onOpenChange={setIsChangelogOpen}
      />

      <AboutSheet
        open={isAboutOpen}
        onOpenChange={setIsAboutOpen}
        version={version}
        onOpenChangelog={() => {
          setIsAboutOpen(false);
          setIsChangelogOpen(true);
        }}
      />

      {isSigningOut && <LoaderOverlay message="Signing out..." />}
    </>
  );
}
