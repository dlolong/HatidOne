import { useEffect, useRef, useState } from "react";
import { Button, Card, Field, Heading, Muted, Notice, clearOperation, money, pendingOperation, readOperation, useAuth, useResource } from "@hatidone/mobile";
import { schedule } from "./format";

export function CashCollection({ rideId }: { rideId: string }) {
  const { client, session } = useAuth();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const action = `cash-${rideId}`;
  const resource = useResource(async () => {
    if (!client) throw new Error("Sign in first.");
    const result = await client.from("cash_collection_events").select("id,operation_id,kind,amount,currency,note,created_at").eq("ride_request_id", rideId).order("created_at");
    if (result.error) throw result.error;
    return result.data;
  }, [client, session?.user.id, rideId]);
  useEffect(() => {
    let live = true;
    if (session) void readOperation(session.user.id, action).then(operation => {
      if (live && operation) {
        const value = JSON.parse(operation.signature) as { amount: string; note: string };
        setAmount(value.amount); setNote(value.note); setPending(true);
      }
    }).catch(() => { if (live) setError("Could not restore the previous report. Review collection history before reporting again."); });
    return () => { live = false; };
  }, [session, action]);
  async function report() {
    if (!client || !session || inFlight.current || resource.stale) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      // Pass an exact decimal string; PostgreSQL numeric performs financial arithmetic.
      if (!/^\d{1,7}(\.\d{1,2})?$/.test(amount)) throw new Error("Enter the PHP amount actually received, including zero, with at most two decimal places.");
      if (note.trim().length < 3) throw new Error("Add a collection note of at least three characters for the audit record.");
      const operationId = await pendingOperation(session.user.id, action, { amount, note });
      setPending(true);
      const result = await client.rpc("record_cash_collection", { p_ride_request_id: rideId, p_operation_id: operationId, p_kind: "reported", p_amount: amount, p_note: note.trim() });
      if (result.error?.code === "P0001") {
        await clearOperation(session.user.id, action); setPending(false);
        throw new Error("Cash report rejected. Check the actual amount against the agreed fare and review existing collection history; operations must resolve adjustments.");
      }
      if (result.error) throw new Error("Report outcome is unresolved. Refresh history; retry keeps the same operation reference and amount.");
      await clearOperation(session.user.id, action); setPending(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Cash report could not be confirmed. Refresh history."); }
    finally { await resource.reload(); inFlight.current = false; setBusy(false); }
  }
  const reported = resource.data?.some(row => row.kind === "reported");
  return <Card>
    <Heading size="section">Cash collection</Heading>
    <Muted>Trip completion does not mean paid. Report only cash you actually received. Operations reconciles or disputes the record separately.</Muted>
    {(error || resource.error) && <Notice tone="error">{error || "Collection history unavailable. Reconnect and refresh before reporting."}</Notice>}
    {!resource.loading && !resource.data?.length && <Muted>No collection recorded; balance remains outstanding.</Muted>}
    {resource.data?.map(row => <Muted key={row.id}>{row.kind === "reported" ? "Driver-reported · awaiting reconciliation" : row.kind === "reconciled" ? "Operations-reconciled" : "Disputed"}: {money(Number(row.amount))} {row.currency} · {schedule(row.created_at)}</Muted>)}
    {!reported && <>
      <Field label="Cash received (PHP)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" editable={!pending} />
      <Field label="Collection note (required)" value={note} onChangeText={setNote} maxLength={500} editable={!pending} />
      <Button label={pending ? "Retry same cash report" : "Record cash received"} loading={busy} disabled={resource.loading || resource.stale || !resource.data} onPress={() => void report()} />
    </>}
    <Button label="Refresh collection history" variant="secondary" onPress={() => void resource.reload()} />
  </Card>;
}
