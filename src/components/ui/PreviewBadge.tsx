export function PreviewBadge({ version }: { version: string }) {
  if (!version.includes("preview")) return null;

  return (
    <span className="px-1.5 py-0.5 rounded-[3px] bg-brand/10 text-brand text-[9px] font-bold uppercase tracking-[0.08em] border border-brand/20 leading-none">
      Preview
    </span>
  );
}
