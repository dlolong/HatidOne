import * as SecureStore from "expo-secure-store";
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";

// Only one pending intent per actor/action. Reuse after a lost response or restart;
// changing a payload requires authoritative reconciliation, never a new silent retry.
export async function pendingOperation(actor: string, action: string, payload: unknown): Promise<string> {
  const key = `hatidone-operation-${actor}-${action}`;
  const signature = JSON.stringify(payload);
  const stored = Platform.OS === "web" ? localStorage.getItem(key) : await SecureStore.getItemAsync(key);
  if (stored) {
    const previous: { id: string; signature: string } = JSON.parse(stored);
    if (previous.signature !== signature) throw new Error("A previous request is unresolved. Restore its details and refresh server history before changing this action.");
    return previous.id;
  }
  const id = randomUUID();
  const value = JSON.stringify({ id, signature });
  if (Platform.OS === "web") localStorage.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
  return id;
}
export async function clearOperation(actor: string, action: string): Promise<void> {
  const key = `hatidone-operation-${actor}-${action}`;
  if (Platform.OS === "web") localStorage.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
}
export async function readOperation(actor: string, action: string): Promise<{ id: string; signature: string } | null> {
  const key = `hatidone-operation-${actor}-${action}`;
  const value = Platform.OS === "web" ? localStorage.getItem(key) : await SecureStore.getItemAsync(key);
  return value ? JSON.parse(value) as { id: string; signature: string } : null;
}
