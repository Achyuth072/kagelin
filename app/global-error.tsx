"use client";

import { useEffect } from "react";

/**
 * Catches errors thrown by the root layout itself (providers, fonts, etc.) —
 * `error.tsx` can't, since it renders *inside* the layout. Next.js requires
 * this file to render its own <html>/<body>; kept deliberately dependency-free
 * (no Tailwind tokens, providers, or app components) since those are exactly
 * what may have just crashed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled root layout error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
          backgroundColor: "#1A1A1A",
          color: "#FCFCFA",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
          Kagelin failed to load
        </h1>
        <p style={{ marginTop: "0.75rem", maxWidth: "28rem", opacity: 0.75 }}>
          Something went wrong before the app could start. Try reloading — your
          data is safe.
        </p>
        <button
          onClick={() => reset()}
          style={{
            marginTop: "1.5rem",
            padding: "0.5rem 1.25rem",
            borderRadius: "0.5rem",
            border: "1px solid rgba(255,255,255,0.2)",
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
