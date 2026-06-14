"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreateProjectSchema,
  type CreateProjectInput,
} from "@/lib/schemas/project";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Send, Palette } from "lucide-react";
import { useCreateProject } from "@/lib/hooks/useProjectMutations";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { ColorPicker } from "@/components/shared/ColorPicker";
import { cn } from "@/lib/utils";
import { IconCell } from "@/components/ui/IconCell";
import { DEFAULT_PROJECT_COLOR } from "@/lib/constants/colors";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
}: CreateProjectDialogProps) {
  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors, isValid },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(CreateProjectSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      color: DEFAULT_PROJECT_COLOR,
      view_style: "list",
    },
  });

  // Reset form when dialog opens or closes
  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const color = useWatch({
    control,
    name: "color",
    defaultValue: DEFAULT_PROJECT_COLOR,
  });
  const createProject = useCreateProject();
  const { trigger } = useHaptic();
  // const scrollRef = useHorizontalScroll();
  const isFinePointer = useMediaQuery("(pointer: fine)");

  const onFormSubmit = (data: CreateProjectInput) => {
    trigger("thud");
    createProject.mutate(data);
    reset();
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[400px] p-0 overflow-hidden">
        <form
          onSubmit={handleSubmit(onFormSubmit)}
          className="flex flex-col h-auto max-h-[90dvh]"
        >
          <ResponsiveDialogHeader className="sr-only">
            <ResponsiveDialogTitle>Create Project</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Organize your tasks into a new project.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {/* Title — native input, bottom border only, no box */}
          <div className="px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
            <input
              {...register("name")}
              id="project-name"
              placeholder="Work, Personal, School..."
              autoFocus={isFinePointer}
              className={cn(
                "w-full text-xl font-semibold tracking-tight bg-transparent border-0 outline-none",
                "placeholder:text-muted-foreground/50 text-foreground",
                errors.name && "placeholder:text-destructive/60",
              )}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (isValid) {
                    handleSubmit(onFormSubmit)();
                  }
                }
              }}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "project-name-error" : undefined}
            />
            {errors.name && (
              <p
                id="project-name-error"
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
                    setValue("color", newColor, { shouldValidate: true })
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
              className="h-9 w-9 p-0 rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm shadow-brand/10 transition-seijaku flex items-center justify-center"
              onClick={() => trigger("success")}
              disabled={!isValid || createProject.isPending}
              aria-label={
                createProject.isPending ? "Creating project" : "Create project"
              }
            >
              <Send className="h-5 w-5 stroke-[2.25px]" />
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
