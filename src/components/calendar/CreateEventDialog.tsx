"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { EventView, type EventViewProps } from "./EventView";
import type { CalendarEventUI } from "@/lib/types/calendar-event";

export interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  event?: CalendarEventUI;
}

export function CreateEventDialog({
  open,
  onOpenChange,
  defaultDate,
  event,
}: CreateEventDialogProps) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[425px] p-0 overflow-visible">
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

        <EventView
          open={open}
          defaultDate={defaultDate}
          event={event}
          onClose={() => onOpenChange(false)}
        />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

// Re-export EventView and EventDialog alias for symmetry with TaskView/HabitView
export { EventView, type EventViewProps };
export const EventDialog = CreateEventDialog;
export type EventDialogProps = CreateEventDialogProps;
