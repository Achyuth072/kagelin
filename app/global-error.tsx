"use client";

import { useEffect, type CSSProperties } from "react";
import { recordDiagnosticError } from "@/lib/errors/diagnostics";
import { useCopyDiagnostics } from "@/lib/errors/useCopyDiagnostics";

const actionButtonStyle: CSSProperties = {
  padding: "0.5rem 1.25rem",
  borderRadius: "0.5rem",
  border: "1px solid rgba(255,255,255,0.2)",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
};

// Renders outside the root layout, so it must supply its own <html>/<body> and
// stay dependency-free — app styles and providers may be what just crashed.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { copied, copyDiagnostics } = useCopyDiagnostics(error);

  useEffect(() => {
    console.error("Unhandled root layout error:", error);
    void recordDiagnosticError(error, { source: "global-error" });
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
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap",
            justifyContent: "center",
            marginTop: "1.5rem",
          }}
        >
          <button type="button" onClick={reset} style={actionButtonStyle}>
            Try again
          </button>
          <button
            type="button"
            onClick={copyDiagnostics}
            style={actionButtonStyle}
          >
            {copied ? "Diagnostics copied" : "Copy diagnostics"}
          </button>
        </div>
      </body>
    </html>
  );
}
