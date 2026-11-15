/** "Today 10:42", "Yesterday", "Jan 4" (or "Jan 4, 2025" in another year). */
export function formatWhen(date: Date, now = new Date()): string {
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

  if (date >= startOfToday) {
    return `Today ${time}`;
  }

  if (date >= startOfYesterday) {
    return `Yesterday ${time}`;
  }

  return date.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  });
}

/** "Mar 2026" */
export function formatMonth(date: Date): string {
  return date.toLocaleDateString("en", { month: "short", year: "numeric" });
}
