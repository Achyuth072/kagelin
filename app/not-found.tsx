import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border/80 bg-card text-card-foreground p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-lg border border-border bg-muted/50 flex items-center justify-center">
            <FileQuestion
              className="h-5 w-5 text-muted-foreground"
              strokeWidth={2.25}
            />
          </div>
          <div>
            <span className="text-xs font-mono uppercase text-brand-text tracking-wider font-semibold block">
              ERR-404
            </span>
            <h1 className="type-h2">Page not found</h1>
          </div>
        </div>

        <p className="type-body text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have been
          moved.
        </p>

        <div className="flex items-center gap-3">
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
