import type { TodoistRow } from "./types";
import { parseTodoistDateAndRecurrence } from "./recurrence";
import type { RecurrenceRule } from "@/lib/utils/recurrence";

export interface MappedTodoistTask {
  tempId: string;
  tempParentId: string | null;
  content: string;
  description: string | null;
  priority: 1 | 2 | 3 | 4;
  dueDate: string | null;
  doDate: string | null;
  recurrence: RecurrenceRule | null;
  indent: number;
}

export interface MapTodoistResult {
  tasks: MappedTodoistTask[];
}

interface HierarchyNode {
  task: MappedTodoistTask;
  rawContent: string;
  indent: number;
}

function cleanAuthorName(author?: string): string | null {
  if (!author) return null;
  const name = author.replace(/\s*\(\d+\)$/, "").trim();
  return name.length > 0 ? name : null;
}

export function mapTodoistRowsToKagelin(
  rows: TodoistRow[],
  refDate: Date = new Date(),
): MapTodoistResult {
  const mappedTasks: MappedTodoistTask[] = [];
  let currentSection: string | null = null;
  let lastTask: MappedTodoistTask | null = null;
  const taskNotes = new Map<
    string,
    Array<{ author?: string; content: string }>
  >();

  // Stack of ancestor tasks indexed by indent level (1-indexed)
  const stack: (HierarchyNode | null)[] = [];

  for (const row of rows) {
    if (row.type === "section") {
      currentSection = row.content.trim() || null;
      continue;
    }

    if (row.type === "meta") {
      continue;
    }

    if (row.type === "note") {
      if (lastTask) {
        const notes = taskNotes.get(lastTask.tempId) ?? [];
        notes.push({
          author: cleanAuthorName(row.author) ?? undefined,
          content: row.content,
        });
        taskNotes.set(lastTask.tempId, notes);
      }
      continue;
    }

    if (row.type === "task") {
      const tempId = crypto.randomUUID();
      const indent = row.indent || 1;
      const rawContent = row.content.trim();

      const priority: 1 | 2 | 3 | 4 = row.priority ?? 4;

      const { dueDate, doDate, recurrence } = parseTodoistDateAndRecurrence({
        dateStr: row.date,
        deadlineStr: row.deadline,
        refDate,
      });

      // Clear deeper hierarchy entries
      for (let i = indent; i < stack.length; i++) {
        stack[i] = null;
      }

      const rootNode = stack[1] ?? null;

      // Check if subtask has explicit dates or priority < 4
      const hasExplicitDate = Boolean(row.date?.trim() || row.deadline?.trim());
      const hasExplicitPriority =
        row.priority !== undefined && row.priority < 4;
      const isPromoted =
        indent >= 2 && (hasExplicitDate || hasExplicitPriority);

      let tempParentId: string | null = null;
      let finalContent = rawContent;

      if (indent === 1) {
        tempParentId = null;
      } else if (isPromoted) {
        tempParentId = null;
        const ancestors = stack
          .slice(1, indent)
          .filter(Boolean)
          .map((n) => n!.rawContent);
        finalContent = [...ancestors, rawContent].join(" > ");
      } else {
        tempParentId = rootNode ? rootNode.task.tempId : null;
        if (indent >= 3) {
          finalContent = `${"—".repeat(indent - 2)} ${rawContent}`;
        }
      }

      if (!tempParentId && currentSection) {
        finalContent = `[${currentSection}] ${finalContent}`;
      }

      // Format description with duration
      const descriptionParts: string[] = [];
      if (row.description && row.description.trim()) {
        descriptionParts.push(row.description.trim());
      }

      if (row.duration !== undefined && row.duration !== null) {
        const unit =
          row.durationUnit === "minute" || !row.durationUnit
            ? "m"
            : row.durationUnit;
        descriptionParts.push(`⏱ Est: ${row.duration}${unit}`);
      }

      const task: MappedTodoistTask = {
        tempId,
        tempParentId,
        content: finalContent,
        description:
          descriptionParts.length > 0 ? descriptionParts.join("\n\n") : null,
        priority,
        dueDate,
        doDate,
        recurrence,
        indent,
      };

      mappedTasks.push(task);
      lastTask = task;

      stack[indent] = {
        task,
        rawContent,
        indent,
      };
    }
  }

  // Append collected notes/comments to task descriptions
  for (const task of mappedTasks) {
    const notes = taskNotes.get(task.tempId);
    if (notes && notes.length > 0) {
      const commentLines = notes.map((note) =>
        note.author
          ? `- **${note.author}**: ${note.content}`
          : `- ${note.content}`,
      );

      const commentsBlock = `---\n### Comments\n${commentLines.join("\n")}`;
      task.description = task.description
        ? `${task.description}\n\n${commentsBlock}`
        : commentsBlock;
    }
  }

  return {
    tasks: mappedTasks,
  };
}
