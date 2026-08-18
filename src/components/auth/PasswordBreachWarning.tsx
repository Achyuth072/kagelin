export function PasswordBreachWarning({ breached }: { breached: boolean }) {
  if (!breached) return null;

  return (
    <p className="text-xs text-amber-600 dark:text-amber-500">
      This password has appeared in known data breaches. You can still use it,
      but choosing a different one is safer.
    </p>
  );
}
