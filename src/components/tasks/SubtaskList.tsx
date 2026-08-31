import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import { useSubtasks } from "@/lib/hooks/useSubtasks";
import {
  useCreateTask,
  useToggleTask,
  useDeleteTask,
  useUpdateTask,
} from "@/lib/hooks/useTaskMutations";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { priorityCheckboxClasses } from "./task-utils";

interface SubtaskListProps {
  taskId?: string;
  projectId: string | null;
  draftSubtasks?: string[];
  onDraftSubtasksChange?: (subtasks: string[]) => void;
  pendingContent?: string;
  onPendingContentChange?: (content: string) => void;
}

export default function SubtaskList({
  taskId,
  projectId,
  draftSubtasks = [],
  onDraftSubtasksChange,
  pendingContent: controlledPendingContent,
  onPendingContentChange: setControlledPendingContent,
}: SubtaskListProps) {
  const [internalNewSubtaskContent, setInternalNewSubtaskContent] =
    useState("");
  const isControlled = controlledPendingContent !== undefined;
  const newSubtaskContent = isControlled
    ? controlledPendingContent
    : internalNewSubtaskContent;
  const setNewSubtaskContent = (val: string) => {
    if (isControlled) {
      setControlledPendingContent?.(val);
    } else {
      setInternalNewSubtaskContent(val);
    }
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  const { data: subtasks } = useSubtasks(taskId || null);
  const createMutation = useCreateTask();
  const toggleMutation = useToggleTask();
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const { trigger } = useHaptic();

  const isDraftMode = !taskId;

  const handleStartEdit = (id: string, content: string) => {
    if (isDraftMode) return;
    setEditingId(id);
    setEditingContent(content);
  };

  const handleSaveEdit = (id: string) => {
    if (!editingContent.trim()) {
      handleDeleteSubtask(id);
    } else {
      updateMutation.mutate({
        id,
        content: editingContent.trim(),
      });
    }
    setEditingId(null);
  };

  const handleAddSubtask = (e?: React.FormEvent) => {
    e?.preventDefault();
    const content = newSubtaskContent.trim();
    if (!content) return;

    if (isDraftMode) {
      onDraftSubtasksChange?.([...draftSubtasks, content]);
      setNewSubtaskContent("");
    } else {
      createMutation.mutate(
        {
          content,
          project_id: projectId || undefined,
          parent_id: taskId,
          priority: 4,
        },
        {
          onSuccess: () => {
            setNewSubtaskContent("");
          },
        },
      );
    }
  };

  const handleDeleteSubtask = (idOrIndex: string | number) => {
    if (isDraftMode) {
      const index = idOrIndex as number;
      onDraftSubtasksChange?.(draftSubtasks.filter((_, i) => i !== index));
    } else {
      deleteMutation.mutate(idOrIndex as string);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, id?: string) => {
    if (e.key === "Enter") {
      if (e.metaKey || e.ctrlKey) {
        return;
      }
      e.preventDefault();
      if (id) {
        handleSaveEdit(id);
      } else {
        handleAddSubtask();
      }
    } else if (e.key === "Escape" && id) {
      setEditingId(null);
    }
  };

  const items = isDraftMode ? draftSubtasks : subtasks || [];

  return (
    <div className="space-y-1 py-1 w-full">
      {items.map((item, index) => {
        const id = typeof item === "string" ? `draft-${index}` : item.id;
        const content = typeof item === "string" ? item : item.content;
        const isCompleted =
          typeof item === "string" ? false : item.is_completed;
        const isEditing = editingId === id;

        return (
          <div
            key={id}
            className="group flex items-center gap-3 py-1.5 px-3 hover:bg-secondary/10 rounded-lg transition-colors"
          >
            <Checkbox
              checked={isCompleted}
              onCheckedChange={(checked) => {
                if (!isDraftMode && typeof item !== "string") {
                  trigger("toggle");
                  toggleMutation.mutate({
                    id: item.id,
                    is_completed: checked as boolean,
                  });
                }
              }}
              disabled={isDraftMode}
              aria-label={`Mark "${content}" complete`}
              className={cn(
                "mt-0.5 h-3.5 w-3.5 !rounded-sm",
                priorityCheckboxClasses[4],
              )}
            />
            {isEditing ? (
              <Input
                autoFocus
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                onBlur={() => handleSaveEdit(id)}
                onKeyDown={(e) => handleKeyDown(e, id)}
                aria-label="Edit step"
                className="flex-1 h-7 py-0 px-0 text-[14px] bg-transparent border-none shadow-none focus-visible:ring-0"
              />
            ) : (
              <span
                onClick={() => !isDraftMode && handleStartEdit(id, content)}
                className={cn(
                  "flex-1 text-[14px] leading-snug transition-all break-all cursor-text",
                  isCompleted &&
                    "text-muted-foreground/60 line-through decoration-muted-foreground/20",
                )}
              >
                {content}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete subtask"
              className="h-7 w-7 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-destructive md:text-muted-foreground md:hover:text-destructive hover:bg-destructive-surface-hover rounded-lg"
              onClick={() => {
                trigger("tick");
                handleDeleteSubtask(
                  isDraftMode ? index : (item as { id: string }).id,
                );
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}

      <div className="flex items-center gap-3 px-3 pt-1 group">
        <button
          type="button"
          aria-label="Add step"
          disabled={!newSubtaskContent.trim()}
          className="flex items-center justify-center w-3.5 h-3.5 shrink-0 text-muted-foreground group-focus-within:text-brand hover:text-brand disabled:hover:text-muted-foreground transition-colors"
          onClick={() => handleAddSubtask()}
        >
          <Plus className="h-3 w-3" strokeWidth={2.5} />
        </button>
        <Input
          value={newSubtaskContent}
          onChange={(e) => setNewSubtaskContent(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e)}
          placeholder="Add a step..."
          aria-label="Add a step"
          className="flex-1 h-8 text-[14px] bg-transparent border-none shadow-none focus-visible:ring-0 placeholder:text-muted-foreground transition-colors p-0"
        />
      </div>
    </div>
  );
}
