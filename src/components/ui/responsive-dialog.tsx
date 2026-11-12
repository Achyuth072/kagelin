"use client";

import * as React from "react";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useBackNavigation } from "@/lib/hooks/useBackNavigation";
import {
  Dialog,
  DialogClose,
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
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  preventTouchAutoFocus,
} from "@/components/ui/drawer";

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

interface ResponsiveDialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  overlayClassName?: string;
  showClose?: boolean;
  children: React.ReactNode;
  onOpenAutoFocus?: (event: Event) => void;
}

interface ResponsiveDialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: React.ReactNode;
}

interface ResponsiveDialogTitleProps {
  className?: string;
  children: React.ReactNode;
}

interface ResponsiveDialogDescriptionProps {
  className?: string;
  children: React.ReactNode;
}

const ResponsiveDialogContext = React.createContext<{ isMobile: boolean }>({
  isMobile: false,
});

export const useIsDrawer = () =>
  React.useContext(ResponsiveDialogContext).isMobile;

export function ResponsiveDialog({
  open,
  onOpenChange,
  children,
}: ResponsiveDialogProps) {
  const isMobile = useMediaQuery("(max-width: 640px)");

  useBackNavigation(isMobile && open, () => onOpenChange(false));

  if (isMobile) {
    return (
      <ResponsiveDialogContext.Provider value={{ isMobile }}>
        <Drawer open={open} onOpenChange={onOpenChange}>
          {children}
        </Drawer>
      </ResponsiveDialogContext.Provider>
    );
  }

  return (
    <ResponsiveDialogContext.Provider value={{ isMobile }}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {children}
      </Dialog>
    </ResponsiveDialogContext.Provider>
  );
}

export const ResponsiveDialogTrigger = React.forwardRef<
  React.ElementRef<typeof DialogTrigger>,
  React.ComponentPropsWithoutRef<typeof DialogTrigger>
>(({ children, asChild, ...props }, ref) => {
  const { isMobile } = React.useContext(ResponsiveDialogContext);

  if (isMobile) {
    return (
      <DrawerTrigger ref={ref} asChild={asChild} {...props}>
        {children}
      </DrawerTrigger>
    );
  }

  return (
    <DialogTrigger ref={ref} asChild={asChild} {...props}>
      {children}
    </DialogTrigger>
  );
});
ResponsiveDialogTrigger.displayName = "ResponsiveDialogTrigger";

export const ResponsiveDialogClose = React.forwardRef<
  React.ElementRef<typeof DialogClose>,
  React.ComponentPropsWithoutRef<typeof DialogClose>
>(({ children, asChild, ...props }, ref) => {
  const { isMobile } = React.useContext(ResponsiveDialogContext);

  if (isMobile) {
    return (
      <DrawerClose ref={ref} asChild={asChild} {...props}>
        {children}
      </DrawerClose>
    );
  }

  return (
    <DialogClose ref={ref} asChild={asChild} {...props}>
      {children}
    </DialogClose>
  );
});
ResponsiveDialogClose.displayName = "ResponsiveDialogClose";

export const ResponsiveDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  ResponsiveDialogContentProps
>(
  (
    {
      className,
      overlayClassName,
      showClose = true,
      children,
      onOpenAutoFocus,
      ...props
    },
    ref,
  ) => {
    const { isMobile } = React.useContext(ResponsiveDialogContext);

    if (isMobile) {
      return (
        <DrawerContent
          ref={ref}
          className={className}
          overlayClassName={overlayClassName}
          onOpenAutoFocus={onOpenAutoFocus}
          {...props}
        >
          {children}
        </DrawerContent>
      );
    }

    return (
      <DialogContent
        ref={ref}
        className={className}
        overlayClassName={overlayClassName}
        showClose={showClose}
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event);
          preventTouchAutoFocus(event);
        }}
        {...props}
      >
        {children}
      </DialogContent>
    );
  },
);
ResponsiveDialogContent.displayName = "ResponsiveDialogContent";

export function ResponsiveDialogHeader({
  className,
  children,
  ...props
}: ResponsiveDialogHeaderProps) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);

  if (isMobile) {
    return (
      <DrawerHeader className={className} {...props}>
        {children}
      </DrawerHeader>
    );
  }

  return (
    <DialogHeader className={className} {...props}>
      {children}
    </DialogHeader>
  );
}

export function ResponsiveDialogTitle({
  className,
  children,
  ...props
}: ResponsiveDialogTitleProps & React.HTMLAttributes<HTMLHeadingElement>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);

  if (isMobile) {
    return (
      <DrawerTitle className={className} {...props}>
        {children}
      </DrawerTitle>
    );
  }

  return (
    <DialogTitle className={className} {...props}>
      {children}
    </DialogTitle>
  );
}

export function ResponsiveDialogDescription({
  className,
  children,
  ...props
}: ResponsiveDialogDescriptionProps &
  React.HTMLAttributes<HTMLParagraphElement>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);

  if (isMobile) {
    return (
      <DrawerDescription className={className} {...props}>
        {children}
      </DrawerDescription>
    );
  }

  return (
    <DialogDescription className={className} {...props}>
      {children}
    </DialogDescription>
  );
}
