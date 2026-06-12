"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Save, Palette } from "lucide-react";
import { useUpdateProject } from "@/lib/hooks/useProjectMutations";
import { useHaptic } from "@/lib/hooks/useHaptic";

import { ColorPicker } from "@/components/shared/ColorPicker";
import { cn } from "@/lib/utils";
import { PROJECT_COLORS } from "@/lib/constants/colors";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import type { Project } from "@/lib/types/task";

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

const EditProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name is too long"),
  color: z.string(),
});

type EditProjectInput = z.infer<typeof EditProjectSchema>;

interface EditProjectDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProjectDialog({
  project,
  open,
  onOpenChange,
}: EditProjectDialogProps) {
  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors, isValid, isDirty },
  } = useForm<EditProjectInput>({
    resolver: zodResolver(EditProjectSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      color: PROJECT_COLORS[0].hex,
    },
  });

  const color = useWatch({
    control,
    name: "color",
    defaultValue: PROJECT_COLORS[0].hex,
  });

  const updateProject = useUpdateProject();
  const { trigger } = useHaptic();
  // const scrollRef = useHorizontalScroll();
  const isFinePointer = useMediaQuery("(pointer: fine)");

  // Sync form with project when opened
  useEffect(() => {
    if (project && open) {
      reset({
        name: project.name,
        color: project.color,
      });
    }
  }, [project, open, reset]);

  const onFormSubmit = (data: EditProjectInput) => {
    if (!project) return;
    trigger("success");
    updateProject.mutate({
      id: project.id,
      name: data.name,
      color: data.color,
    });
    onOpenChange(false);
  };

  if (!project) return null;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[400px] p-0 overflow-hidden">
        <form
          onSubmit={handleSubmit(onFormSubmit)}
          className="flex flex-col h-auto max-h-[90dvh]"
        >
          <ResponsiveDialogHeader className="sr-only">
            <ResponsiveDialogTitle>Edit Project</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Update project name and color.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {/* Title — native input, bottom border only, no box */}
          <div className="px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
            <input
              {...register("name")}
              id="edit-project-name"
              placeholder="Project name..."
              autoFocus={isFinePointer}
              className={cn(
                "w-full text-xl font-semibold tracking-tight bg-transparent border-0 outline-none",
                "placeholder:text-muted-foreground/50 text-foreground",
                errors.name && "placeholder:text-destructive/60",
              )}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (isValid && isDirty) {
                    handleSubmit(onFormSubmit)();
                  }
                }
              }}
              aria-invalid={!!errors.name}
              aria-describedby={
                errors.name ? "edit-project-name-error" : undefined
              }
            />
            {errors.name && (
              <p
                id="edit-project-name-error"
                className="text-xs text-destructive mt-1"
              >
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto min-h-0 py-2">
            <div className="flex items-start gap-3 px-3 py-2.5 rounded-md mx-2">
              <IconCell>
                <Palette
                  className="h-4 w-4 text-muted-foreground"
                  strokeWidth={2.25}
                />
              </IconCell>
              <div className="flex-1 min-w-0">
                <ColorPicker
                  value={color}
                  onChange={(newColor) =>
                    setValue("color", newColor, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  ariaLabel="Project color"
                />
              </div>
            </div>

            <div className="h-1" />
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-t border-border/40 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-background w-full max-w-full">
            <div className="flex-1" />
            <Button
              type="submit"
              size="sm"
              variant={updateProject.isPending ? "ghost" : "default"}
              className={cn(
                "h-9 w-9 p-0 rounded-lg transition-seijaku flex items-center justify-center",
                !updateProject.isPending &&
                  "bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm shadow-brand/10",
              )}
              onClick={() => trigger("success")}
              disabled={!isValid || !isDirty || updateProject.isPending}
              aria-label={
                updateProject.isPending ? "Saving project" : "Save project"
              }
            >
              <Save
                className={cn(
                  "h-5 w-5 stroke-[2.25px]",
                  updateProject.isPending && "opacity-50",
                )}
              />
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
