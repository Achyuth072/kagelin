"use client";

import React from "react";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useBackNavigation } from "@/lib/hooks/useBackNavigation";

interface SignOutConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  allDevices?: boolean;
}

export function SignOutConfirmation({
  isOpen,
  onClose,
  onConfirm,
  allDevices = false,
}: SignOutConfirmationProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { trigger } = useHaptic();

  useBackNavigation(isOpen && !isDesktop, onClose);

  const title = allDevices ? "Sign Out of All Devices" : "Sign Out";
  const description = allDevices
    ? "This will end your session on every device signed in to this account, including this one. You'll need to log in again everywhere."
    : "Are you sure you want to sign out? You will need to log in again to access your tasks.";

  if (isDesktop) {
    return (
      <AlertDialog open={isOpen} onOpenChange={onClose}>
        <AlertDialogContent className="max-w-md border-border/40 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5" />
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => trigger("tick")}
              className="hover:bg-accent/60 transition-colors"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                trigger("thud");
                onConfirm();
              }}
            >
              {title}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={onClose} repositionInputs={false}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5" />
            {title}
          </DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter className="pt-2">
          <Button
            onClick={() => {
              trigger("thud");
              onConfirm();
            }}
            variant="destructive"
            className="w-full active:scale-95 transition-transform"
          >
            {title}
          </Button>
          <DrawerClose asChild>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => trigger("tick")}
            >
              Cancel
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
