"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Settings,
  Timer,
  Coffee,
  Moon,
  Repeat,
  Play,
  Zap,
  ListRestart,
  Save,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTimer } from "@/components/TimerProvider";
import { useBackNavigation } from "@/lib/hooks/useBackNavigation";

import {
  useForm,
  FormProvider,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FocusSettingsSchema } from "@/lib/schemas/settings";
import { TimerSettings } from "@/lib/types/timer";

// Fixed-width icon cell — keeps text columns aligned across all rows.
function IconCell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-5 shrink-0 flex items-start justify-center pt-[3px]">
      {children}
    </div>
  );
}

const rowCls =
  "flex items-start gap-3 px-3 py-2.5 rounded-md mx-2 hover:bg-muted/40 transition-seijaku-fast";

// Extracted settings form component
function SettingsForm() {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<TimerSettings>();

  // useWatch is React Compiler-compatible (unlike watch() for rendering).
  // React Compiler memoizes components and skips re-renders when it cannot
  // detect state changes — watch("field") uses an internal pub/sub that the
  // compiler cannot track, causing toggles and sliders to appear stuck.
  const focusDuration = useWatch({ control, name: "focusDuration" });
  const shortBreak = useWatch({ control, name: "shortBreakDuration" });
  const longBreak = useWatch({ control, name: "longBreakDuration" });
  const sessions = useWatch({ control, name: "sessionsBeforeLongBreak" });
  const autoStartBreak = useWatch({ control, name: "autoStartBreak" });
  const autoStartFocus = useWatch({ control, name: "autoStartFocus" });
  const taskSwitchBehavior = useWatch({ control, name: "taskSwitchBehavior" });

  return (
    <div className="py-2">
      {/* Focus Duration */}
      <div className={rowCls}>
        <IconCell>
          <Timer className="h-4 w-4 text-muted-foreground" strokeWidth={2.25} />
        </IconCell>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Focus Duration
            </span>
            <div className="flex items-center gap-1.5">
              <input
                id="focus-duration-input"
                type="number"
                {...register("focusDuration", { valueAsNumber: true })}
                className={cn(
                  "w-10 bg-transparent border-0 outline-none text-sm text-right text-foreground",
                  errors.focusDuration && "text-destructive",
                )}
                aria-invalid={!!errors.focusDuration}
                aria-describedby={
                  errors.focusDuration ? "focus-duration-error" : undefined
                }
              />
              <span className="text-sm text-muted-foreground">min</span>
            </div>
          </div>
          <Slider
            value={[focusDuration]}
            onValueChange={([value]) =>
              setValue("focusDuration", value, { shouldValidate: true })
            }
            min={1}
            max={120}
            step={1}
            className="w-full"
          />
          {errors.focusDuration && (
            <p
              id="focus-duration-error"
              className="text-xs text-destructive font-medium"
            >
              {errors.focusDuration.message}
            </p>
          )}
        </div>
      </div>

      {/* Short Break */}
      <div className={rowCls}>
        <IconCell>
          <Coffee
            className="h-4 w-4 text-muted-foreground"
            strokeWidth={2.25}
          />
        </IconCell>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Short Break
            </span>
            <div className="flex items-center gap-1.5">
              <input
                id="short-break-input"
                type="number"
                {...register("shortBreakDuration", { valueAsNumber: true })}
                className={cn(
                  "w-10 bg-transparent border-0 outline-none text-sm text-right text-foreground",
                  errors.shortBreakDuration && "text-destructive",
                )}
                aria-invalid={!!errors.shortBreakDuration}
                aria-describedby={
                  errors.shortBreakDuration ? "short-break-error" : undefined
                }
              />
              <span className="text-sm text-muted-foreground">min</span>
            </div>
          </div>
          <Slider
            value={[shortBreak]}
            onValueChange={([value]) =>
              setValue("shortBreakDuration", value, { shouldValidate: true })
            }
            min={1}
            max={30}
            step={1}
            className="w-full"
          />
          {errors.shortBreakDuration && (
            <p
              id="short-break-error"
              className="text-xs text-destructive font-medium"
            >
              {errors.shortBreakDuration.message}
            </p>
          )}
        </div>
      </div>

      {/* Long Break */}
      <div className={rowCls}>
        <IconCell>
          <Moon className="h-4 w-4 text-muted-foreground" strokeWidth={2.25} />
        </IconCell>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Long Break
            </span>
            <div className="flex items-center gap-1.5">
              <input
                id="long-break-input"
                type="number"
                {...register("longBreakDuration", { valueAsNumber: true })}
                className={cn(
                  "w-10 bg-transparent border-0 outline-none text-sm text-right text-foreground",
                  errors.longBreakDuration && "text-destructive",
                )}
                aria-invalid={!!errors.longBreakDuration}
                aria-describedby={
                  errors.longBreakDuration ? "long-break-error" : undefined
                }
              />
              <span className="text-sm text-muted-foreground">min</span>
            </div>
          </div>
          <Slider
            value={[longBreak]}
            onValueChange={([value]) =>
              setValue("longBreakDuration", value, { shouldValidate: true })
            }
            min={5}
            max={60}
            step={1}
            className="w-full"
          />
          {errors.longBreakDuration && (
            <p
              id="long-break-error"
              className="text-xs text-destructive font-medium"
            >
              {errors.longBreakDuration.message}
            </p>
          )}
        </div>
      </div>

      {/* Sessions Before Long Break */}
      <div className={rowCls}>
        <IconCell>
          <Repeat
            className="h-4 w-4 text-muted-foreground"
            strokeWidth={2.25}
          />
        </IconCell>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Sessions Until Long Break
            </span>
            <input
              id="sessions-input"
              type="number"
              {...register("sessionsBeforeLongBreak", { valueAsNumber: true })}
              className={cn(
                "w-10 bg-transparent border-0 outline-none text-sm text-right text-foreground",
                errors.sessionsBeforeLongBreak && "text-destructive",
              )}
              aria-invalid={!!errors.sessionsBeforeLongBreak}
              aria-describedby={
                errors.sessionsBeforeLongBreak ? "sessions-error" : undefined
              }
            />
          </div>
          <Slider
            value={[sessions]}
            onValueChange={([value]) =>
              setValue("sessionsBeforeLongBreak", value, {
                shouldValidate: true,
              })
            }
            min={2}
            max={10}
            step={1}
            className="w-full"
          />
          {errors.sessionsBeforeLongBreak && (
            <p
              id="sessions-error"
              className="text-xs text-destructive font-medium"
            >
              {errors.sessionsBeforeLongBreak.message}
            </p>
          )}
        </div>
      </div>

      <div className="h-1" />

      {/* Auto-start Breaks */}
      <div className={cn(rowCls, "items-center")}>
        <IconCell>
          <Play className="h-4 w-4 text-muted-foreground" strokeWidth={2.25} />
        </IconCell>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">
            Auto-start Breaks
          </div>
          <p className="text-xs text-muted-foreground">
            Automatically start break timer after focus session
          </p>
        </div>
        <Switch
          id="auto-start-break-switch"
          checked={autoStartBreak}
          onCheckedChange={(checked) =>
            setValue("autoStartBreak", checked, { shouldValidate: true })
          }
        />
      </div>

      {/* Auto-start Focus */}
      <div className={cn(rowCls, "items-center")}>
        <IconCell>
          <Zap className="h-4 w-4 text-muted-foreground" strokeWidth={2.25} />
        </IconCell>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">
            Auto-start Focus
          </div>
          <p className="text-xs text-muted-foreground">
            Automatically start focus timer after break
          </p>
        </div>
        <Switch
          id="auto-start-focus-switch"
          checked={autoStartFocus}
          onCheckedChange={(checked) =>
            setValue("autoStartFocus", checked, { shouldValidate: true })
          }
        />
      </div>

      <div className="h-1" />

      {/* Task Switch Behavior */}
      <div className={rowCls}>
        <IconCell>
          <ListRestart
            className="h-4 w-4 text-muted-foreground"
            strokeWidth={2.25}
          />
        </IconCell>
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <div className="text-sm font-medium text-foreground">
              On task switch
            </div>
            <p className="text-xs text-muted-foreground">
              What happens when you change tasks during a session
            </p>
          </div>
          <Tabs
            value={
              taskSwitchBehavior === "keepRunning"
                ? "keep"
                : taskSwitchBehavior === "pauseOnSwitch"
                  ? "pause"
                  : "reset"
            }
            onValueChange={(v) => {
              if (v) {
                const mapped =
                  v === "keep"
                    ? "keepRunning"
                    : v === "pause"
                      ? "pauseOnSwitch"
                      : "resetOnSwitch";
                setValue("taskSwitchBehavior", mapped, {
                  shouldValidate: true,
                });
              }
            }}
            className="w-full"
          >
            <TabsList className="grid grid-cols-3 w-full bg-secondary/10 p-1 rounded-lg h-9 border border-border/40 shadow-none">
              <TabsTrigger
                value="keep"
                className={cn(
                  "rounded-md text-[12px] font-medium tracking-tight h-7 px-2",
                  "data-[state=active]:bg-brand data-[state=active]:text-brand-foreground data-[state=active]:shadow-none transition-seijaku-fast",
                  "border border-transparent data-[state=active]:border-brand/20 text-muted-foreground hover:text-foreground hover:bg-secondary/40",
                )}
              >
                Keep
              </TabsTrigger>
              <TabsTrigger
                value="pause"
                className={cn(
                  "rounded-md text-[12px] font-medium tracking-tight h-7 px-2",
                  "data-[state=active]:bg-brand data-[state=active]:text-brand-foreground data-[state=active]:shadow-none transition-seijaku-fast",
                  "border border-transparent data-[state=active]:border-brand/20 text-muted-foreground hover:text-foreground hover:bg-secondary/40",
                )}
              >
                Pause
              </TabsTrigger>
              <TabsTrigger
                value="reset"
                className={cn(
                  "rounded-md text-[12px] font-medium tracking-tight h-7 px-2",
                  "data-[state=active]:bg-brand data-[state=active]:text-brand-foreground data-[state=active]:shadow-none transition-seijaku-fast",
                  "border border-transparent data-[state=active]:border-brand/20 text-muted-foreground hover:text-foreground hover:bg-secondary/40",
                )}
              >
                Reset
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="h-1" />
    </div>
  );
}

export function FocusSettingsDialog() {
  const { settings, updateSettings } = useTimer();
  const { trigger, isPhone } = useHaptic();
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const methods = useForm<TimerSettings>({
    resolver: zodResolver(FocusSettingsSchema),
    mode: "all",
    defaultValues: {
      focusDuration: settings.focusDuration,
      shortBreakDuration: settings.shortBreakDuration,
      longBreakDuration: settings.longBreakDuration,
      sessionsBeforeLongBreak: settings.sessionsBeforeLongBreak,
      autoStartBreak: settings.autoStartBreak,
      autoStartFocus: settings.autoStartFocus,
      taskSwitchBehavior: settings.taskSwitchBehavior,
    },
  });

  const {
    handleSubmit,
    reset,
    watch,
    formState: { isValid },
  } = methods;

  // Stable ref for updateSettings — prevents useEffect resubscribing on every
  // timer tick (TimerProvider recreates the context object each second because
  // timer.state changes, causing updateSettings reference to appear new even
  // though the underlying Zustand action is stable).
  const updateSettingsRef = useRef(updateSettings);
  useEffect(() => {
    updateSettingsRef.current = updateSettings;
  }, [updateSettings]);

  // D-08: Direct reactive persistence - save settings instantly
  // This ensures changes are applied even if the dialog is open during a session
  useEffect(() => {
    // eslint-disable-next-line
    const subscription = watch((value) => {
      // Save on any form value change (setValue, native input, etc.)
      // RHF watch(callback) does not fire on initial subscription — no mount guard needed.
      // type === "change" was previously used as a guard but it is only set for native DOM
      // change events; setValue() (used by sliders/switches) fires with type: undefined,
      // causing slider/switch changes to never persist. safeParse provides the safety net.
      if (value) {
        const parsed = FocusSettingsSchema.safeParse(value);
        if (parsed.success) {
          updateSettingsRef.current(parsed.data);
        }
      }
    });
    return () => subscription.unsubscribe();
    // watch is a stable reference (RHF guarantee) — updateSettings via ref above
  }, [watch]);

  // Handle back navigation on mobile to close drawer instead of navigating away
  useBackNavigation(open && !isDesktop, () => setOpen(false));

  const onFormSubmit = () => {
    trigger("thud");
    // Settings already saved via watch() - just close
    setOpen(false);
  };

  const handleCancel = () => {
    trigger("tick");
    reset();
    setOpen(false);
  };

  const triggerButton = (
    <motion.button
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "text-muted-foreground hover:text-foreground hover:bg-accent active:scale-95 active:bg-accent/50 transition-all cursor-pointer",
      )}
      onTapStart={() => trigger("thud")}
      whileTap={isPhone ? { scale: 0.95 } : {}}
    >
      <Settings className="h-4 w-4 mr-2" />
      Adjust Settings
    </motion.button>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{triggerButton}</DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Timer Settings</DialogTitle>
            <DialogDescription>
              Customize your focus and break durations
              <span id="settings-desc" className="sr-only">
                Form to update timer durations and transitions
              </span>
            </DialogDescription>
          </DialogHeader>
          <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onFormSubmit)}>
              <SettingsForm />
              <div className="flex items-center gap-3 pt-4 border-t border-border/40 mt-2">
                <div className="flex-1" />
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-9 p-0 [&_svg]:size-5! rounded-lg transition-seijaku-fast"
                  onClick={handleCancel}
                  aria-label="Cancel"
                >
                  <X strokeWidth={2.25} />
                </Button>
                <Button
                  type="submit"
                  disabled={!isValid}
                  className="h-9 w-9 p-0 rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm shadow-brand/10 transition-seijaku flex items-center justify-center"
                  aria-label="Save changes"
                >
                  <Save className="h-5 w-5 stroke-[2.25px]" />
                </Button>
              </div>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} repositionInputs={false}>
      <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
      <DrawerContent className="max-h-[92dvh] flex flex-col">
        <DrawerHeader className="text-left shrink-0">
          <DrawerTitle>Timer Settings</DrawerTitle>
          <DrawerDescription>
            Customize your focus and break durations
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 overflow-y-auto flex-1 scrollbar-hide">
          <FormProvider {...methods}>
            <SettingsForm />
          </FormProvider>
        </div>
        <DrawerFooter className="flex-row items-center gap-3 pt-2 shrink-0 border-t border-border/40 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <DrawerClose asChild>
            <Button
              variant="outline"
              className="h-9 w-9 p-0 [&_svg]:size-5! rounded-lg transition-seijaku-fast"
              onClick={handleCancel}
              aria-label="Cancel"
            >
              <X strokeWidth={2.25} />
            </Button>
          </DrawerClose>
          <div className="flex-1" />
          <Button
            onClick={handleSubmit(onFormSubmit)}
            disabled={!isValid}
            className="h-9 w-9 p-0 rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm shadow-brand/10 transition-seijaku flex items-center justify-center"
            aria-label="Save changes"
          >
            <Save className="h-5 w-5 stroke-[2.25px]" />
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
