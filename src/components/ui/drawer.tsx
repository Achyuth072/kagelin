import * as React from "react";
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";

import { cn } from "@/lib/utils";
import { useDialogActive } from "@/lib/hooks/useDialogActive";

type VaulDirection = "top" | "bottom" | "left" | "right";
type BaseUISwipeDirection = "up" | "down" | "left" | "right";

const DIRECTION_MAP: Record<VaulDirection, BaseUISwipeDirection> = {
  top: "up",
  bottom: "down",
  left: "left",
  right: "right",
};

type DrawerProps = React.ComponentProps<typeof DrawerPrimitive.Root> & {
  /** Legacy Vaul prop accepted as a no-op for caller compatibility. */
  shouldScaleBackground?: boolean;
  /** Legacy Vaul direction prop mapped to Base UI `swipeDirection`. */
  direction?: VaulDirection;
};

const Drawer = ({
  open,
  defaultOpen,
  shouldScaleBackground: _shouldScaleBackground,
  direction,
  swipeDirection,
  children,
  ...props
}: DrawerProps) => {
  useDialogActive(open ?? defaultOpen);
  const resolvedSwipeDirection =
    swipeDirection ?? (direction ? DIRECTION_MAP[direction] : "down");

  return (
    <DrawerPrimitive.Root
      open={open}
      defaultOpen={defaultOpen}
      swipeDirection={resolvedSwipeDirection}
      {...props}
    >
      {typeof children === "function" ? (
        (payload) => (
          <DrawerPrimitive.VirtualKeyboardProvider>
            {children(payload)}
          </DrawerPrimitive.VirtualKeyboardProvider>
        )
      ) : (
        <DrawerPrimitive.VirtualKeyboardProvider>
          {children}
        </DrawerPrimitive.VirtualKeyboardProvider>
      )}
    </DrawerPrimitive.Root>
  );
};
Drawer.displayName = "Drawer";

type DrawerTriggerProps = Omit<
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Trigger>,
  "children"
> & {
  asChild?: boolean;
  children?: React.ReactNode;
};

const DrawerTrigger = React.forwardRef<HTMLButtonElement, DrawerTriggerProps>(
  ({ asChild, children, render, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      return <DrawerPrimitive.Trigger ref={ref} render={children} {...props} />;
    }
    return (
      <DrawerPrimitive.Trigger ref={ref} render={render} {...props}>
        {children}
      </DrawerPrimitive.Trigger>
    );
  },
);
DrawerTrigger.displayName = "DrawerTrigger";

const DrawerPortal = DrawerPrimitive.Portal;

type DrawerCloseProps = Omit<
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Close>,
  "children"
> & {
  asChild?: boolean;
  children?: React.ReactNode;
};

const DrawerClose = React.forwardRef<HTMLButtonElement, DrawerCloseProps>(
  ({ asChild, children, render, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      return <DrawerPrimitive.Close ref={ref} render={children} {...props} />;
    }
    return (
      <DrawerPrimitive.Close ref={ref} render={render} {...props}>
        {children}
      </DrawerPrimitive.Close>
    );
  },
);
DrawerClose.displayName = "DrawerClose";

const DrawerOverlay = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Backdrop>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Backdrop
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 opacity-[calc(1-var(--drawer-swipe-progress,0))] transition-opacity [transition-duration:calc(300ms*var(--drawer-swipe-strength,1))] ease-seijaku will-change-[opacity] data-[swiping]:duration-0 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-reduce:transition-none",
      className,
    )}
    {...props}
  />
));
DrawerOverlay.displayName = "DrawerOverlay";

function isTouchPointer(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    !window.matchMedia("(pointer: fine)").matches
  );
}

function preventTouchAutoFocus(event: Event) {
  if (!event.defaultPrevented && isTouchPointer()) {
    event.preventDefault();
  }
}

function blurActiveInput() {
  const activeEl = document.activeElement;
  if (
    activeEl instanceof HTMLInputElement ||
    activeEl instanceof HTMLTextAreaElement ||
    (activeEl instanceof HTMLElement && activeEl.isContentEditable)
  ) {
    activeEl.blur();
  }
}

type DrawerContentProps = React.ComponentPropsWithoutRef<
  typeof DrawerPrimitive.Popup
> & {
  overlayClassName?: string;
  onOpenAutoFocus?: (event: Event) => void;
};

const DrawerContent = React.forwardRef<HTMLDivElement, DrawerContentProps>(
  (
    {
      className,
      overlayClassName,
      children,
      onOpenAutoFocus,
      initialFocus,
      ...props
    },
    forwardedRef,
  ) => {
    const popupRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
      if (!isTouchPointer()) return;
      blurActiveInput();
      const raf = window.requestAnimationFrame(blurActiveInput);
      return () => window.cancelAnimationFrame(raf);
    }, []);

    const setPopupRef = (node: HTMLDivElement | null) => {
      popupRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    };

    const resolvedInitialFocus: DrawerContentProps["initialFocus"] =
      initialFocus !== undefined
        ? initialFocus
        : (openType) => {
            if (onOpenAutoFocus) {
              const event = new Event("openAutoFocus", { cancelable: true });
              onOpenAutoFocus(event);
              preventTouchAutoFocus(event);
              if (event.defaultPrevented) {
                return false;
              }
            } else if (openType === "touch" || isTouchPointer()) {
              return false;
            }
            return popupRef.current ?? true;
          };

    return (
      <DrawerPortal>
        <DrawerOverlay className={overlayClassName} />
        <DrawerPrimitive.Viewport className="fixed inset-0 z-50 flex items-end justify-center pb-[var(--drawer-keyboard-inset,0px)]">
          <DrawerPrimitive.Popup
            ref={setPopupRef}
            data-slot="drawer-content"
            initialFocus={resolvedInitialFocus}
            className={cn(
              "relative flex h-auto w-full max-h-[85dvh] flex-col overflow-y-auto rounded-t-xl border-t border-border-strong bg-background shadow-none outline-none [transform:translate3d(var(--drawer-swipe-movement-x,0px),var(--drawer-swipe-movement-y,0px),0)] transition-transform [transition-duration:calc(300ms*var(--drawer-swipe-strength,1))] ease-seijaku will-change-transform data-[swiping]:duration-0 data-[swipe-direction=down]:data-[starting-style]:[transform:translateY(100%)] data-[swipe-direction=down]:data-[ending-style]:[transform:translateY(100%)] data-[swipe-direction=up]:data-[starting-style]:[transform:translateY(-100%)] data-[swipe-direction=up]:data-[ending-style]:[transform:translateY(-100%)] data-[swipe-direction=left]:data-[starting-style]:[transform:translateX(-100%)] data-[swipe-direction=left]:data-[ending-style]:[transform:translateX(-100%)] data-[swipe-direction=right]:data-[starting-style]:[transform:translateX(100%)] data-[swipe-direction=right]:data-[ending-style]:[transform:translateX(100%)] motion-reduce:transition-none",
              className,
            )}
            {...props}
          >
            <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted shrink-0" />
            {children}
          </DrawerPrimitive.Popup>
        </DrawerPrimitive.Viewport>
      </DrawerPortal>
    );
  },
);
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
    {...props}
  />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    {...props}
  />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  />
));
DrawerTitle.displayName = "DrawerTitle";

const DrawerDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DrawerDescription.displayName = "DrawerDescription";

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  isTouchPointer,
  preventTouchAutoFocus,
};
