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
  RotateCcw,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { cn } from "@/lib/utils";
import { IconCell } from "@/components/ui/IconCell";
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
import { TimerSettings, TaskSwitchBehavior } from "@/lib/types/timer";

const rowCls =
  "flex items-start gap-3 px-3 py-2.5 rounded-md mx-2 hover:bg-muted/40 transition-seijaku-fast";

const numberInputCls =
  "w-10 bg-transparent border-0 outline-none text-sm text-right text-foreground [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const tabTriggerCls = cn(
  "rounded-md text-[12px] font-medium tracking-tight h-7 px-2",
  "data-[state=active]:bg-brand data-[state=active]:text-brand-foreground data-[state=active]:shadow-none transition-seijaku-fast",
  "border border-transparent data-[state=active]:border-brand/20 text-muted-foreground hover:text-foreground hover:bg-secondary/40",
);

const resetBtnCls =
  "h-9 w-9 p-0 [&_svg]:size-5! rounded-lg transition-seijaku-fast";
const saveBtnCls =
  "h-9 w-9 p-0 rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm shadow-brand/10 transition-seijaku flex items-center justify-center";

const TASK_SWITCH_TO_TAB: Record<TaskSwitchBehavior, string> = {
  keepRunning: "keep",
  pauseOnSwitch: "pause",
  resetOnSwitch: "reset",
};

const TAB_TO_TASK_SWITCH: Record<string, TaskSwitchBehavior> = {
  keep: "keepRunning",
  pause: "pauseOnSwitch",
  reset: "resetOnSwitch",
};

function SettingsForm() {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<TimerSettings>();

  // useWatch (not watch()) so React Compiler can track re-renders — watch()'s
  // pub/sub isn't compiler-visible and leaves sliders/switches stuck.
  const focusDuration = useWatch({ control, name: "focusDuration" });
  const shortBreak = useWatch({ control, name: "shortBreakDuration" });
  const longBreak = useWatch({ control, name: "longBreakDuration" });
  const sessions = useWatch({ control, name: "sessionsBeforeLongBreak" });
  const autoStartBreak = useWatch({ control, name: "autoStartBreak" });
  const autoStartFocus = useWatch({ control, name: "autoStartFocus" });
  const taskSwitchBehavior = useWatch({ control, name: "taskSwitchBehavior" });

  return (
    <div className="py-2">
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
                aria-label="Focus Duration"
                type="number"
                {...register("focusDuration", { valueAsNumber: true })}
                className={cn(
                  numberInputCls,
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
                aria-label="Short Break"
                type="number"
                {...register("shortBreakDuration", { valueAsNumber: true })}
                className={cn(
                  numberInputCls,
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
                  numberInputCls,
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
                numberInputCls,
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
            value={TASK_SWITCH_TO_TAB[taskSwitchBehavior]}
            onValueChange={(v) => {
              if (v) {
                setValue("taskSwitchBehavior", TAB_TO_TASK_SWITCH[v], {
                  shouldValidate: true,
                });
              }
            }}
            className="w-full"
          >
            <TabsList className="grid grid-cols-3 w-full bg-secondary/10 p-1 rounded-lg h-9 border border-border/40 shadow-none">
              <TabsTrigger value="keep" className={tabTriggerCls}>
                Keep
              </TabsTrigger>
              <TabsTrigger value="pause" className={tabTriggerCls}>
                Pause
              </TabsTrigger>
              <TabsTrigger value="reset" className={tabTriggerCls}>
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

  // Ref keeps this stable across TimerProvider's per-tick context recreation,
  // which would otherwise resubscribe the effect below every second.
  const updateSettingsRef = useRef(updateSettings);
  useEffect(() => {
    updateSettingsRef.current = updateSettings;
  }, [updateSettings]);

  // Persist on every form change so edits apply even while the dialog is open.
  useEffect(() => {
    // eslint-disable-next-line
    const subscription = watch((value) => {
      // setValue() (sliders/switches) fires with type: undefined, so we can't
      // gate on type === "change" — safeParse is the safety net instead.
      if (value) {
        const parsed = FocusSettingsSchema.safeParse(value);
        if (parsed.success) {
          updateSettingsRef.current(parsed.data);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  useBackNavigation(open && !isDesktop, () => setOpen(false));

  const onFormSubmit = () => {
    trigger("thud");
    setOpen(false);
  };

  const handleReset = () => {
    trigger("tick");
    // Bare reset() reverts to the defaultValues snapshot captured once at
    // mount, which goes stale (or is zeroed pre-hydration) — pass the live
    // saved settings explicitly so this always restores the true saved state.
    reset(settings);
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
                  className={resetBtnCls}
                  onClick={handleReset}
                  aria-label="Reset to saved settings"
                >
                  <RotateCcw strokeWidth={2.25} />
                </Button>
                <Button
                  type="submit"
                  disabled={!isValid}
                  className={saveBtnCls}
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
          <Button
            variant="outline"
            className={resetBtnCls}
            onClick={handleReset}
            aria-label="Reset to saved settings"
          >
            <RotateCcw strokeWidth={2.25} />
          </Button>
          <div className="flex-1" />
          <Button
            onClick={handleSubmit(onFormSubmit)}
            disabled={!isValid}
            className={saveBtnCls}
            aria-label="Save changes"
          >
            <Save className="h-5 w-5 stroke-[2.25px]" />
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
