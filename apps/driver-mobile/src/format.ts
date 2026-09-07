export function peso(value: number | string | null | undefined): string {
  return value === null || value === undefined
    ? "Pending"
    : new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 2,
      }).format(Number(value));
}
export function schedule(value: string | null): string {
  return value
    ? new Date(value).toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "As soon as possible";
}
export function label(value: string): string {
  return value.replaceAll("_", " ");
}
export function dayGroup(
  value: string | null,
  now = new Date(),
): "Today" | "Tomorrow" | "Upcoming" {
  if (!value) return "Today";
  const day = new Date(value);
  if (day.toDateString() === now.toDateString()) return "Today";
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return day.toDateString() === tomorrow.toDateString()
    ? "Tomorrow"
    : "Upcoming";
}
export function localDateInput(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
