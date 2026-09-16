import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { userError } from "./errors";
import { randomUUID } from "expo-crypto";
import { useAuth } from "./auth";
import { useResource } from "./resource";
import { Button, Card, Field, Heading, Muted, Notice, LoadingSkeleton, theme, dateTime } from "./ui";
interface Message {
  id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
}
export function RideChat({ rideRequestId }: { rideRequestId: string }) {
  const { client, session } = useAuth();
  const [body, setBody] = useState("");
  const [visible, setVisible] = useState(20);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<{ body: string; id: string } | null>(null);
  const resource = useResource(async () => {
    if (!client) return [];
    const result = await client
      .from("ride_messages")
      .select("id,sender_user_id,body,created_at")
      .eq("ride_request_id", rideRequestId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (result.error) throw new Error(result.error.message);
    const read = await client.rpc("mark_ride_messages_read", {
      p_ride_request_id: rideRequestId,
    });
    if (read.error) throw new Error(read.error.message);
    return (result.data as Message[]).reverse();
  }, [client, rideRequestId, session?.user.id]);
  const { reload } = resource;
  useEffect(() => {
    if (!client) return;
    const channel = client
      .channel(`chat:${rideRequestId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ride_messages",
          filter: `ride_request_id=eq.${rideRequestId}`,
        },
        () => void reload(),
      )
      .subscribe((status) => { if (status === "SUBSCRIBED") void reload(); });
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, rideRequestId, reload]);
  async function send() {
    if (!client || !body.trim() || sending) return;
    setSending(true);
    setError("");
    const text = body.trim();
    if (pending.current?.body !== text)
      pending.current = { body: text, id: randomUUID() };
    try {
      const result = await client.rpc("send_ride_message", {
        p_ride_request_id: rideRequestId,
        p_body: text,
        p_client_message_id: pending.current.id,
      });
      if (result.error) throw new Error(result.error.message);
      pending.current = null;
      setBody("");
      await reload();
    } catch (reason) {
      setError(
        userError(reason, "Your message wasn’t sent. Try again; it won’t be sent twice."),
      );
    } finally {
      setSending(false);
    }
  }
  return (
    <Card>
      <Heading size="section">Trip messages</Heading>
      <Muted>
        Only authorized trip participants can read this conversation.
      </Muted>
      {resource.loading && !resource.data && <LoadingSkeleton lines={2} />}
      {(resource.error || error) && (
        <Notice tone="error">{error || resource.error}</Notice>
      )}
      {resource.data?.length === 0 && (
        <Muted>No messages yet. Coordinate your pickup here.</Muted>
      )}
      {resource.data && resource.data.length > visible && <Button label="Earlier messages" variant="secondary" onPress={() => setVisible(count => count + 20)} />}
      {resource.data?.slice(-visible).map((message) => (
        <View key={message.id} style={{ padding: 12, gap: 6, borderRadius: 10, backgroundColor: message.sender_user_id === session?.user.id ? theme.subtle : theme.surface, borderWidth: 1, borderColor: theme.border }}>
          <Muted>
            {message.sender_user_id === session?.user.id
              ? "You"
              : "Trip participant"}{" "}
            · {dateTime(message.created_at)}
          </Muted>
          <Text selectable style={{ color: theme.text, fontSize: 16, lineHeight: 23 }}>{message.body}</Text>
        </View>
      ))}
      <Field
        label="Message"
        placeholder="Confirm your pickup landmark…"
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={2000}
      />
      <Button
        label="Send message"
        loading={sending}
        disabled={!body.trim()}
        onPress={() => void send()}
      />
    </Card>
  );
}
