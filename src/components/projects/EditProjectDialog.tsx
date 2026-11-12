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
import {
  useUpdateProject,
  useArchiveProject,
} from "@/lib/hooks/useProjectMutations";
import { useProjectActions } from "@/components/ProjectActionsProvider";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { PROJECT_COLORS } from "@/lib/constants/colors";
import type { Project } from "@/lib/types/task";
import { ProjectView } from "./ProjectView";

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

  const name = useWatch({
    control,
    name: "name",
    defaultValue: "",
  });

  const color = useWatch({
    control,
    name: "color",
    defaultValue: PROJECT_COLORS[0].hex,
  });

  const updateProject = useUpdateProject();
  const archiveProject = useArchiveProject();
  const { openDeleteProject } = useProjectActions();
  const { trigger } = useHaptic();

  // Sync form with project when opened
  useEffect(() => {
    if (project && open) {
      reset({
        name: project.name ?? "",
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

  const handleArchive = () => {
    if (!project) return;
    trigger("thud");
    archiveProject.mutate(project.id);
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!project) return;
    trigger("thud");
    onOpenChange(false);
    openDeleteProject(project);
  };

  if (!project) return null;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[400px] p-0 overflow-hidden">
        <ResponsiveDialogHeader className="sr-only">
          <ResponsiveDialogTitle>Edit Project</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Update project name and color.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ProjectView
          mode="edit"
          layout="sheet"
          projectId={project.id}
          name={name}
          setName={(val) => {
            setValue("name", val, { shouldValidate: true, shouldDirty: true });
          }}
          color={color}
          setColor={(val) => {
            setValue("color", val, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }}
          isPending={updateProject.isPending}
          isValid={isValid}
          isDirty={isDirty}
          errors={errors}
          onSubmit={handleSubmit(onFormSubmit)}
          onArchive={handleArchive}
          onDelete={handleDelete}
        />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
