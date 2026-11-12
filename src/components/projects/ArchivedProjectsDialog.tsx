"use client";

import { useState } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { useArchivedProjects } from "@/lib/hooks/useProjects";
import {
  useUnarchiveProject,
  useHardDeleteProject,
} from "@/lib/hooks/useProjectMutations";
import { Button } from "@/components/ui/button";
import { Archive, ArchiveRestore, Loader2, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeleteConfirmationDialog } from "@/components/ui/DeleteConfirmationDialog";
import {
  ReadableText,
  UNREADABLE_LABEL,
} from "@/components/encryption/ReadableText";
import type { Project } from "@/lib/types/task";

interface ArchivedProjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArchivedProjectsDialog({
  open,
  onOpenChange,
}: ArchivedProjectsDialogProps) {
  const { data: archivedProjects, isLoading } = useArchivedProjects();
  const unarchiveProject = useUnarchiveProject();
  const hardDeleteProject = useHardDeleteProject();
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
        <ResponsiveDialogContent className="sm:max-w-md p-0 overflow-hidden">
          <ResponsiveDialogHeader className="px-4 pt-6 shrink-0">
            <ResponsiveDialogTitle className="type-h2">
              Archived Projects
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="sr-only">
              View, restore or delete archived projects
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2
                  className="h-6 w-6 animate-spin text-muted-foreground"
                  strokeWidth={2.25}
                />
              </div>
            ) : archivedProjects && archivedProjects.length > 0 ? (
              <div className="space-y-1">
                {archivedProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-md hover:bg-muted/40 transition-seijaku-fast"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="font-medium truncate">
                        <ReadableText text={project.name} />
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 hover:bg-secondary/60 text-xs font-medium"
                        onClick={() => unarchiveProject.mutate(project.id)}
                        disabled={unarchiveProject.isPending}
                      >
                        <ArchiveRestore
                          className="h-4 w-4"
                          strokeWidth={2.25}
                        />
                        Restore
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => setProjectToDelete(project)}
                        aria-label={`Delete ${project.name ?? UNREADABLE_LABEL}`}
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={2.25} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Archive}
                title="No archived projects"
                description="Projects you archive will show up here for restoring later."
                className="py-8 gap-4"
              />
            )}
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <DeleteConfirmationDialog
        isOpen={projectToDelete !== null}
        onClose={() => setProjectToDelete(null)}
        onConfirm={() => {
          if (projectToDelete) {
            hardDeleteProject.mutate(projectToDelete.id);
          }
          setProjectToDelete(null);
        }}
        title="Delete Project"
        description={`Are you sure you want to permanently delete "${projectToDelete?.name ?? UNREADABLE_LABEL}"? This action cannot be undone.`}
      />
    </>
  );
}
