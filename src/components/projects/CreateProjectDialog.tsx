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
import { useCreateProject } from "@/lib/hooks/useProjectMutations";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { DEFAULT_PROJECT_COLOR } from "@/lib/constants/colors";
import { ProjectView } from "./ProjectView";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
}: CreateProjectDialogProps) {
  const {
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

  const name = useWatch({
    control,
    name: "name",
    defaultValue: "",
  });

  const color = useWatch({
    control,
    name: "color",
    defaultValue: DEFAULT_PROJECT_COLOR,
  });

  const createProject = useCreateProject();
  const { trigger } = useHaptic();

  const onFormSubmit = (data: CreateProjectInput) => {
    trigger("thud");
    createProject.mutate(data);
    reset();
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[400px] p-0 overflow-hidden">
        <ResponsiveDialogHeader className="sr-only">
          <ResponsiveDialogTitle>Create Project</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Organize your tasks into a new project.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ProjectView
          mode="create"
          layout="sheet"
          name={name}
          setName={(val) => {
            setValue("name", val, { shouldValidate: true, shouldDirty: true });
          }}
          color={color}
          setColor={(val) => {
            setValue("color", val, { shouldValidate: true, shouldDirty: true });
          }}
          isPending={createProject.isPending}
          isValid={isValid}
          errors={errors}
          onSubmit={handleSubmit(onFormSubmit)}
        />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
