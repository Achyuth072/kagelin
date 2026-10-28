export interface DiagnosticLogEntry {
  timestamp: string;
  category?: string;
  level?: string;
  message?: string;
  data?: Record<string, unknown>;
}

export function getRecentClientLogs(_limit = 50): DiagnosticLogEntry[] {
  return [];
}
