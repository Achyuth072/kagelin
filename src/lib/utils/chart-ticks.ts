// Recharts' XAxis `interval` prop: labels 0-indexed, skipping `interval` between shows.
export function computeTickInterval(
  dataLength: number,
  targetTicks: number,
): number {
  return Math.max(0, Math.ceil(dataLength / targetTicks) - 1);
}
