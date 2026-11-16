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

export function formatMonth(date: Date): string {
  return date.toLocaleDateString("en", { month: "short", year: "numeric" });
}

export function formatDuration(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${Math.max(0, Math.floor(milliseconds / 1000))}s`;
}
