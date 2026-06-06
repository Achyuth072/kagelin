"use client";

"use no memo";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo } from "react";
import { useForm, useWatch, useFormState } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, isValid } from "date-fns";
import {
  Calendar,
  Clock,
  MapPin,
  AlignLeft,
  Sun,
  Trash2,
  Check,
  Send,
  Save,
} from "lucide-react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DateTimeWizard } from "@/components/ui/date-time-wizard";
import {
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
} from "@/lib/hooks/useCalendarEventMutations";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { parseEventInput } from "@/lib/utils/nlp-event";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useCalendarStore } from "@/lib/calendar/store";
import type { CalendarEventUI } from "@/lib/types/calendar-event";

const CreateEventSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  all_day: z.boolean().default(false),
});

type CreateEventFormData = z.infer<typeof CreateEventSchema>;

const PREDEFINED_LOCATIONS = [
  "Coffee Shop",
  "Office",
  "Zoom Meeting",
  "Google Meet",
  "Home",
  "Library",
  "Gym",
];

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  event?: CalendarEventUI;
}

function coerceValidDate(value: unknown): Date | undefined {
  if (value instanceof Date) return isValid(value) ? value : undefined;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return isValid(parsed) ? parsed : undefined;
  }
  return undefined;
}

function getDefaultEndDate(start: Date) {
  return new Date(start.getTime() + 3600000);
}

// Wraps a disabled button with a cursor-not-allowed span and a tooltip explaining
// why recurring events are read-only.
function RecurringTooltip({
  isRecurring,
  children,
}: {
  isRecurring: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={isRecurring ? "cursor-not-allowed" : undefined}>
          {children}
        </span>
      </TooltipTrigger>
      {isRecurring && (
        <TooltipContent side="top">
          Recurring events can only be edited in the source calendar
        </TooltipContent>
      )}
    </Tooltip>
  );
}

// Fixed-width icon cell — keeps text columns aligned across all rows.
function IconCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-5 shrink-0 flex items-start justify-center pt-[3px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CreateEventDialog({
  open,
  onOpenChange,
  defaultDate,
  event,
}: CreateEventDialogProps) {
  const { trigger } = useHaptic();
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();
  const isFinePointer = useMediaQuery("(pointer: fine)");
  const normalizedDefaultDate = coerceValidDate(defaultDate);
  const normalizedEventStart = coerceValidDate(event?.start);
  const normalizedEventEnd = coerceValidDate(event?.end);
  const initialStartDate = useMemo(
    () => normalizedEventStart ?? normalizedDefaultDate ?? new Date(),
    [normalizedDefaultDate, normalizedEventStart],
  );
  const initialEndDate = useMemo(
    () => normalizedEventEnd ?? getDefaultEndDate(initialStartDate),
    [initialStartDate, normalizedEventEnd],
  );

  const [startDate, setStartDate] = useState<Date | undefined>(
    initialStartDate,
  );
  const [endDate, setEndDate] = useState<Date | undefined>(initialEndDate);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationPortalEl, setLocationPortalEl] =
    useState<HTMLDivElement | null>(null);
  const events = useCalendarStore((state) => state.events);
  const safeStartDate = coerceValidDate(startDate);
  const safeEndDate = coerceValidDate(endDate);

  const uniqueLocations = useMemo(() => {
    const history = events
      .map((e) => e.location)
      .filter((loc): loc is string => Boolean(loc && loc.trim() !== ""));
    return Array.from(new Set([...PREDEFINED_LOCATIONS, ...history]));
  }, [events]);

  const { register, handleSubmit, control, setValue, reset } =
    useForm<CreateEventFormData>({
      resolver: zodResolver(CreateEventSchema) as any,
      mode: "onChange",
      defaultValues: {
        title: "",
        description: "",
        location: "",
        all_day: false,
      },
    });

  const allDay = useWatch({ control, name: "all_day" });
  const title = useWatch({ control, name: "title" });
  const locationValue = useWatch({ control, name: "location" });
  const { errors } = useFormState({ control });

  // Derive form validity from useWatch values instead of formState.isValid
  // or useFormState().isValid. Both formState and useFormState use RHF's Proxy
  // for property-access subscriptions, which React Compiler memoizes away —
  // isValid never triggers a re-render. useWatch is an explicit hook subscription
  // that React Compiler tracks correctly.
  const isFormValid =
    !!title && title.trim().length >= 1 && title.length <= 200;

  const isRecurring = !!event?.metadata?.recurring_series_id;

  // NLP parsing on title change (only when creating)
  useEffect(() => {
    if (event || !title || title.length < 3) return;
    const parsed = parseEventInput(title);
    const start = parsed.start;
    const end = parsed.end;
    const isAllDay = parsed.allDay;
    if (start) {
      const timer = setTimeout(() => {
        setStartDate(start);
        setEndDate(coerceValidDate(end) ?? getDefaultEndDate(start));
        if (isAllDay) setValue("all_day", true);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [title, setValue, event]);

  // Reset/Initialize form when dialog opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        if (event) {
          setStartDate(normalizedEventStart ?? initialStartDate);
          setEndDate(
            normalizedEventEnd ??
              getDefaultEndDate(normalizedEventStart ?? initialStartDate),
          );
          reset({
            title: event.title,
            description: event.description || "",
            location: event.location || "",
            all_day: event.allDay || false,
          });
        } else {
          const now = normalizedDefaultDate ?? new Date();
          setStartDate(now);
          setEndDate(getDefaultEndDate(now));
          reset({ title: "", description: "", location: "", all_day: false });
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [
    event,
    initialStartDate,
    normalizedDefaultDate,
    normalizedEventEnd,
    normalizedEventStart,
    open,
    reset,
  ]);

  const onFormSubmit = (data: CreateEventFormData) => {
    if (!safeStartDate || !safeEndDate) return;
    trigger("thud");
    if (event) {
      updateEvent.mutate({
        id: event.id,
        title: data.title,
        description: data.description || undefined,
        location: data.location || undefined,
        start_time: safeStartDate.toISOString(),
        end_time: safeEndDate.toISOString(),
        all_day: data.all_day,
      });
    } else {
      createEvent.mutate({
        title: data.title,
        description: data.description || undefined,
        location: data.location || undefined,
        start_time: safeStartDate.toISOString(),
        end_time: safeEndDate.toISOString(),
        all_day: data.all_day,
      });
    }
    trigger("success");
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!event) return;
    trigger("thud");
    deleteEvent.mutate(event.id);
    onOpenChange(false);
  };

  const rowCls =
    "flex items-center gap-3 px-3 py-2.5 rounded-md mx-2 transition-colors";
  const hoverCls = isRecurring ? "" : "hover:bg-muted/40";

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[425px] p-0">
        <form
          onSubmit={handleSubmit(onFormSubmit) as any}
          className="flex flex-col h-auto max-h-[85dvh]"
        >
          {/* a11y title — hidden visually; the native input is the visual title */}
          <ResponsiveDialogHeader className="sr-only">
            <ResponsiveDialogTitle>
              {event ? "Edit Event" : "Create Event"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {event
                ? "Edit this calendar event"
                : "Add a new event to your calendar"}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {/* Title — native input, bottom border only, no box */}
          <div className="px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
            <input
              {...register("title")}
              id="event-title"
              placeholder="Add title"
              autoFocus={isFinePointer && !isRecurring}
              disabled={isRecurring}
              className={cn(
                "w-full text-xl font-semibold tracking-tight bg-transparent border-0 outline-none",
                "placeholder:text-muted-foreground/50 text-foreground",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                errors.title && "placeholder:text-destructive/60",
              )}
            />
            {errors.title && (
              <p className="text-xs text-destructive mt-1">
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Portal target for location dropdown. Sits inside the Dialog DOM so
              react-remove-scroll allows wheel events, but outside overflow-y-auto
              so the fixed-position popup never clips at the scroll container edge. */}
          <div ref={setLocationPortalEl} />

          {/* Body */}
          <div className="flex-1 overflow-y-auto min-h-0 py-2">
            {/* All-day row */}
            <div className={cn(rowCls, hoverCls)}>
              <IconCell>
                <Sun
                  className="h-4 w-4 text-muted-foreground"
                  strokeWidth={2.25}
                />
              </IconCell>
              <span className="text-sm flex-1 text-foreground">All day</span>
              <Switch
                id="all-day"
                checked={allDay}
                disabled={isRecurring}
                onCheckedChange={(checked) => {
                  trigger("toggle");
                  setValue("all_day", checked);
                }}
              />
            </div>

            {/* Time block — left accent groups start + end */}
            <div
              className={cn(
                "mx-2 my-1 pl-3 border-l-2 border-brand/40 rounded-r-md",
                !isRecurring && "hover:bg-muted/40 transition-colors",
              )}
            >
              {/* Start */}
              <Popover open={showStartPicker} onOpenChange={setShowStartPicker}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={isRecurring}
                    onClick={() => trigger("tick")}
                    className="w-full flex items-center gap-3 px-2 py-2 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <IconCell>
                      <Calendar
                        className="h-4 w-4 text-muted-foreground"
                        strokeWidth={2.25}
                      />
                    </IconCell>
                    <span className="text-sm text-foreground">
                      {safeStartDate
                        ? allDay
                          ? format(safeStartDate, "PPP")
                          : format(safeStartDate, "PPP p")
                        : "Pick a date"}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 overflow-hidden"
                  align="start"
                  collisionPadding={16}
                  style={{
                    maxHeight:
                      "min(380px, var(--radix-popover-content-available-height, 80dvh))",
                  }}
                >
                  <DateTimeWizard
                    date={safeStartDate}
                    setDate={setStartDate}
                    onClose={() => setShowStartPicker(false)}
                    showTime={!allDay}
                    compact
                  />
                </PopoverContent>
              </Popover>

              {/* End */}
              <Popover open={showEndPicker} onOpenChange={setShowEndPicker}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={isRecurring}
                    onClick={() => trigger("tick")}
                    className="w-full flex items-center gap-3 px-2 py-2 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <IconCell>
                      <Clock
                        className="h-4 w-4 text-muted-foreground"
                        strokeWidth={2.25}
                      />
                    </IconCell>
                    <span className="text-sm text-muted-foreground">
                      {safeEndDate
                        ? allDay
                          ? format(safeEndDate, "PPP")
                          : format(safeEndDate, "PPP p")
                        : "Pick an end time"}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 overflow-hidden"
                  align="start"
                  collisionPadding={16}
                  style={{
                    maxHeight:
                      "min(380px, var(--radix-popover-content-available-height, 80dvh))",
                  }}
                >
                  <DateTimeWizard
                    date={safeEndDate}
                    setDate={setEndDate}
                    onClose={() => setShowEndPicker(false)}
                    showTime={!allDay}
                    compact
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="h-1" />

            {/* Location */}
            <div className="mx-2">
              <Popover
                open={locationOpen}
                onOpenChange={setLocationOpen}
                modal={false}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    aria-expanded={locationOpen}
                    disabled={isRecurring}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
                      !isRecurring && "hover:bg-muted/40",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                  >
                    <IconCell>
                      <MapPin
                        className="h-4 w-4 text-muted-foreground"
                        strokeWidth={2.25}
                      />
                    </IconCell>
                    <span
                      className={cn(
                        "text-sm flex-1 truncate",
                        locationValue
                          ? "text-foreground"
                          : "text-muted-foreground/60",
                      )}
                    >
                      {locationValue || "Add location"}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="p-0 w-[var(--radix-popover-trigger-width)]"
                  align="start"
                  container={locationPortalEl}
                  onOpenAutoFocus={
                    isFinePointer ? undefined : (e) => e.preventDefault()
                  }
                >
                  <Command shouldFilter={true}>
                    <CommandInput
                      placeholder="Search or enter location..."
                      value={locationValue || ""}
                      onValueChange={(val) => {
                        setValue("location", val, { shouldValidate: true });
                      }}
                    />
                    <CommandList>
                      <CommandEmpty>
                        Press enter or click outside to use custom location
                      </CommandEmpty>
                      <CommandGroup heading="Suggestions">
                        {uniqueLocations.map((loc) => (
                          <CommandItem
                            key={loc}
                            value={loc}
                            className="text-foreground data-[selected=true]:bg-brand data-[selected=true]:text-brand-foreground"
                            onSelect={() => {
                              setValue("location", loc, {
                                shouldValidate: true,
                              });
                              setLocationOpen(false);
                            }}
                          >
                            <MapPin className="mr-2 h-4 w-4" />
                            {loc}
                            <Check
                              className={cn(
                                "ml-auto h-4 w-4",
                                locationValue === loc
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Notes */}
            <div className="mx-2">
              <div
                className={cn(
                  "flex items-start gap-3 px-3 py-2.5 rounded-md transition-colors",
                  !isRecurring && "hover:bg-muted/40",
                )}
              >
                <IconCell className="pt-[5px]">
                  <AlignLeft
                    className="h-4 w-4 text-muted-foreground"
                    strokeWidth={2.25}
                  />
                </IconCell>
                <textarea
                  {...register("description")}
                  id="event-description"
                  placeholder="Add notes"
                  rows={2}
                  disabled={isRecurring}
                  className={cn(
                    "flex-1 bg-transparent border-0 outline-none resize-none",
                    "text-sm text-foreground placeholder:text-muted-foreground/60",
                    "leading-relaxed p-0 min-h-[48px]",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                />
              </div>
            </div>

            <div className="h-1" />
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-t border-border/40 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-background sm:rounded-b-lg">
            {event && (
              <RecurringTooltip isRecurring={isRecurring}>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-9 w-9 p-0 [&_svg]:size-5! rounded-lg shadow-sm shadow-destructive/10 transition-seijaku-fast"
                  onClick={handleDelete}
                  disabled={isRecurring || deleteEvent.isPending}
                  aria-label="Delete event"
                >
                  <Trash2 strokeWidth={2.25} />
                </Button>
              </RecurringTooltip>
            )}
            <div className="flex-1" />
            <RecurringTooltip isRecurring={isRecurring}>
              <Button
                type="submit"
                size="sm"
                disabled={
                  isRecurring ||
                  !isFormValid ||
                  !safeStartDate ||
                  !safeEndDate ||
                  createEvent.isPending ||
                  updateEvent.isPending
                }
                className="h-9 w-9 p-0 rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm shadow-brand/10 transition-seijaku flex items-center justify-center"
                aria-label={event ? "Save changes" : "Create event"}
              >
                {event ? (
                  <Save className="h-5 w-5 stroke-[2.25px]" />
                ) : (
                  <Send className="h-5 w-5 stroke-[2.25px]" />
                )}
              </Button>
            </RecurringTooltip>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
