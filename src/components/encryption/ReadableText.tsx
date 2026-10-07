import { ShieldAlert } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Never write back as content.
export const UNREADABLE_LABEL = "Can't be read";

const UNREADABLE_HINT =
  "This text was changed outside Kagelin or is damaged. Delete it or type a new one.";

export function ReadableText({ text }: { text: string | null }) {
  if (text !== null) return text;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex items-center gap-1 italic opacity-70"
          data-testid="unreadable-text"
        >
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {UNREADABLE_LABEL}
        </span>
      </TooltipTrigger>
      <TooltipContent>{UNREADABLE_HINT}</TooltipContent>
    </Tooltip>
  );
}
