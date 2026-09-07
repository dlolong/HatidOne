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
  const labels: Record<string, string> = {
    assigned: "Driver assigned", driver_en_route: "Heading to pickup", driver_arrived: "At pickup",
    trip_started: "Trip in progress", trip_completed: "Completed", driver_cancelled: "Cancelled by driver",
    passenger_cancelled: "Cancelled by passenger", no_show: "Passenger no-show", under_review: "Under review",
    verified: "Verified", pending: "Pending review", active: "Active", rejected: "Needs an update",
    local_estimate: "Estimated route", fastest: "Fastest route", avoid_tolls: "Avoid tolls",
    suv: "SUV", local: "Local ride", instant: "Immediate ride", transfer: "Transfer", scheduled: "Scheduled ride",
  };
  return labels[value] ?? value.replaceAll("_", " ").replace(/^./, (first) => first.toUpperCase());
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

export function statusTone(value: string): "neutral" | "success" | "warning" | "danger" {
  if (["verified", "active", "trip_completed", "available"].includes(value)) return "success";
  if (["pending", "under_review", "expired", "rejected"].includes(value)) return "warning";
  if (value.includes("cancelled") || value === "no_show") return "danger";
  return "neutral";
}
export function driverError(reason: unknown, fallback = "We couldn’t load or update your driver details. Check your connection, refresh and try again."): string {
  const text = reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "";
  const messages: [RegExp, string][] = [
    [/incorrect passenger pin/i, "That PIN did not match. Ask the passenger to check their booking and try again. Repeated attempts temporarily lock pickup."],
    [/pin temporarily locked/i, "PIN checks are temporarily locked. Wait a few minutes, then ask the passenger to check their PIN."],
    [/too early to start/i, "This pickup is more than 30 minutes away. You can start the trip closer to its scheduled time."],
    [/no.show waiting period/i, "Wait at least 10 minutes after the scheduled pickup and your arrival before reporting a no-show. Try contacting the passenger first."],
    [/another trip is still/i, "Finish your current trip before starting the next one."],
    [/no longer eligible|schedule conflict|overlap/i, "This job is no longer compatible with your schedule, vehicle or documents. Refresh Jobs or review your Account."],
    [/offer.*(expired|not found|unavailable)|already.*(accepted|assigned)/i, "This offer is no longer available. Refresh Jobs to see other rides."],
    [/invalid trip action|invalid ride state|active assignment required|trip unavailable/i, "This trip has changed. Refresh its details before trying again."],
    [/verified driver required|driver profile required|driver role required|assigned.*driver required/i, "Your driver account cannot perform this action. Review your application in Account or contact operations."],
    [/location permission is off/i, "Location permission is off. Enable it in device settings or enter your position in Account → Location."],
    [/location sharing could not update|live foreground location is unavailable/i, "Your location could not update. Try Update GPS; trip controls remain available."],
    [/invalid coordinates/i, "Check your latitude and longitude, then try again."],
    [/preferences too large/i, "Use fewer preferred areas, then save your preferences again."],
  ];
  return messages.find(([pattern]) => pattern.test(text))?.[1] ?? fallback;
}
