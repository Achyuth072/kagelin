"use client";

import * as React from "react";
import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import { Minus, Plus } from "lucide-react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { cn } from "@/lib/utils";

export interface NumberFieldProps extends Omit<
  BaseNumberField.Root.Props,
  "value" | "onValueChange" | "children"
> {
  value?: number | null;
  onValueChange?: (
    value: number | null,
    eventDetails: BaseNumberField.Root.ChangeEventDetails,
  ) => void;
  /** Controls display of decrement/increment buttons. Defaults to true. */
  showSteppers?: boolean;
  /** Controls enablement of desktop scrub area. Defaults to true. */
  scrub?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  decrementAriaLabel?: string;
  incrementAriaLabel?: string;
  className?: string;
  inputClassName?: string;
}

export function NumberField({
  value,
  onValueChange,
  showSteppers = true,
  scrub = true,
  placeholder,
  "aria-label": ariaLabel,
  decrementAriaLabel = "Decrease value",
  incrementAriaLabel = "Increase value",
  className,
  inputClassName,
  min,
  max,
  step = 1,
  disabled,
  autoFocus,
  ...rootProps
}: NumberFieldProps) {
  const { trigger } = useHaptic();

  const handleValueChange: BaseNumberField.Root.Props["onValueChange"] = (
    nextVal,
    eventDetails,
  ) => {
    // Trigger tick haptic on button/keyboard/scrub step changes
    if (
      eventDetails.reason === "increment-press" ||
      eventDetails.reason === "decrement-press" ||
      eventDetails.reason === "keyboard" ||
      eventDetails.reason === "scrub" ||
      eventDetails.reason === "wheel"
    ) {
      trigger("tick");
    }
    onValueChange?.(nextVal, eventDetails);
  };

  const inputElement = (
    <BaseNumberField.Input
      aria-label={ariaLabel}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={cn(
        "h-8 min-w-10 text-center text-[13px] font-medium tabular-nums text-foreground bg-transparent p-0 outline-none placeholder:text-muted-foreground/60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
        !showSteppers && "px-2.5",
        inputClassName,
      )}
    />
  );

  return (
    <BaseNumberField.Root
      value={value}
      onValueChange={handleValueChange}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={cn("inline-flex items-center", className)}
      {...rootProps}
    >
      <BaseNumberField.Group
        className={cn(
          "inline-flex items-center h-8 rounded-lg border border-border/40 bg-secondary/10 transition-colors focus-within:border-border/60 focus-within:ring-1 focus-within:ring-brand/40",
          disabled && "opacity-50 pointer-events-none",
        )}
      >
        {showSteppers && (
          <BaseNumberField.Decrement
            aria-label={decrementAriaLabel}
            className="h-8 w-8 flex items-center justify-center rounded-l-lg text-muted-foreground transition-seijaku-fast hover:text-foreground hover:bg-secondary/40 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <Minus className="h-3.5 w-3.5" strokeWidth={2.25} />
          </BaseNumberField.Decrement>
        )}

        {scrub ? (
          <BaseNumberField.ScrubArea
            direction="horizontal"
            className="relative flex items-center cursor-ew-resize"
          >
            {inputElement}
            <BaseNumberField.ScrubAreaCursor className="hidden" />
          </BaseNumberField.ScrubArea>
        ) : (
          inputElement
        )}

        {showSteppers && (
          <BaseNumberField.Increment
            aria-label={incrementAriaLabel}
            className="h-8 w-8 flex items-center justify-center rounded-r-lg text-muted-foreground transition-seijaku-fast hover:text-foreground hover:bg-secondary/40 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          </BaseNumberField.Increment>
        )}
      </BaseNumberField.Group>
    </BaseNumberField.Root>
  );
}
