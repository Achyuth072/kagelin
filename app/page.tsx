import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { HomeClient } from "@/components/home/HomeClient";

// Performance: Root page is now a Server Component (PERF-01).
// Interactivity is moved to HomeClient to minimize the client-side hydration tree.
export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2
            className="h-6 w-6 text-muted-foreground animate-spin"
            strokeWidth={2.25}
          />
          <span className="sr-only">Loading...</span>
        </div>
      }
    >
      <HomeClient />
    </Suspense>
  );
}
