/** Present known failures without exposing database, SQL or provider internals. */
export function userError(reason: unknown, fallback = "Something went wrong. Check your connection and try again."): string {
  const message = typeof reason === "string" ? reason : reason instanceof Error ? reason.message : typeof reason === "object" && reason !== null && "message" in reason && typeof reason.message === "string" ? reason.message : "";
  if (/invalid login credentials/i.test(message)) return "The email or password is incorrect. Please try again.";
  if (/email not confirmed/i.test(message)) return "Confirm your email, then sign in again.";
  if (/already registered|already been registered/i.test(message)) return "An account already uses this email. Try signing in.";
  if (/password.*(weak|least|short)/i.test(message)) return "Use a stronger password with at least 8 characters.";
  if (/rate limit|too many requests|too many.*attempt/i.test(message)) return "Too many attempts. Wait a moment, then try again.";
  if (/network|failed to fetch|fetch failed|timeout|timed out/i.test(message)) return "We couldn’t connect. Check your internet connection and try again.";
  if (/jwt expired|session.*expired|refresh token/i.test(message)) return "Your session has expired. Sign in again to continue.";
  if (/permission.*location|location.*permission/i.test(message)) return "Location access is unavailable. Allow it in Settings or enter your location manually.";
  return fallback;
}
