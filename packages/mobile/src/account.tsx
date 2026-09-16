import { useRef, useState } from "react";
import { useAuth } from "./auth";
import { useResource } from "./resource";
import { Button, Card, Field, Heading, Muted, Notice, dateTime } from "./ui";

export function AccountDeletionRequest() {
  const { client, session } = useAuth();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const resource = useResource(async () => {
    if (!client || !session) return [];
    const result = await client.from("account_deletion_requests").select("id,status,created_at").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(1);
    if (result.error) throw result.error;
    return result.data;
  }, [client, session?.user.id]);
  async function request() {
    if (!client || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const result = await client.rpc("request_account_deletion", { p_reason: reason.trim() });
      if (result.error) throw result.error;
      setReason("");
    } catch { setError("Request could not be confirmed. Refresh the request status before trying again."); }
    finally { await resource.reload(); setBusy(false); inFlight.current = false; }
  }
  const latest = resource.data?.[0];
  return <Card>
    <Heading size="section">Account deletion review</Heading>
    <Muted>Request an account deletion review. Records are not automatically deleted. The owner’s retention policy and handling process require approval; no completion date is promised.</Muted>
    {(error || resource.error) && <Notice tone="error">{error || "Request status unavailable. Refresh to try again."}</Notice>}
    {latest ? <Notice>Request {latest.status} · {dateTime(latest.created_at)}. This records a request, not completed deletion.</Notice> : <>
      <Field label="Reason or request details" value={reason} onChangeText={setReason} multiline maxLength={2000} />
      <Button label="Request deletion review" variant="secondary" loading={busy} disabled={reason.trim().length < 3 || resource.loading || resource.stale} onPress={() => void request()} />
    </>}
    <Button label="Refresh request status" variant="secondary" onPress={() => void resource.reload()} />
  </Card>;
}
