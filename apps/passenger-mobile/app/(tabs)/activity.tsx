import { useCallback, useEffect, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  Button,
  Card,
  Heading,
  Muted,
  Notice,
  Screen,
  dateTime,
  useAuth,
  useResource,
} from "@hatidone/mobile";
import { getNotifications } from "../../src/data";
export default function Activity() {
  const { client, session } = useAuth();
  const [error, setError] = useState("");
  const resource = useResource(
    () => getNotifications(client, session?.user.id),
    [client, session?.user.id],
  );
  useFocusEffect(
    useCallback(() => {
      void resource.reload();
    }, [resource.reload]),
  );
  useEffect(() => {
    if (!client || !session) return;
    const channel = client
      .channel("passenger-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${session.user.id}`,
        },
        () => void resource.reload(),
      )
      .subscribe();
    const timer = setInterval(() => void resource.reload(), 20000);
    return () => {
      clearInterval(timer);
      void client.removeChannel(channel);
    };
  }, [client, session?.user.id, resource.reload]);
  async function markRead(id: string) {
    if (!client) return;
    const result = await client.rpc("mark_notification_read", {
      p_notification_id: id,
    });
    if (result.error) setError(result.error.message);
    else {
      setError("");
      await resource.reload();
    }
  }
  return (
    <Screen
      refreshing={resource.loading}
      onRefresh={() => void resource.reload()}
    >
      <Heading>Activity</Heading>
      <Muted>Your in-app trip updates. Pull down to refresh at any time.</Muted>
      {(error || resource.error) && (
        <Notice tone="error">{error || resource.error}</Notice>
      )}
      {resource.loading && !resource.data && <Muted>Loading updates…</Muted>}
      {resource.data?.length === 0 && (
        <Card>
          <Heading>You’re all caught up</Heading>
          <Muted>Booking and driver updates will appear here.</Muted>
        </Card>
      )}
      {resource.data?.map((notification) => (
        <Card key={notification.id}>
          <Muted>
            {notification.read_at ? "READ" : "NEW"} ·{" "}
            {dateTime(notification.created_at)}
          </Muted>
          <Heading>{notification.title}</Heading>
          <Muted>{notification.body}</Muted>
          {notification.ride_request_id && (
            <Button
              label="View booking"
              onPress={() => {
                void markRead(notification.id);
                router.push({
                  pathname: "/booking/[id]",
                  params: { id: notification.ride_request_id! },
                });
              }}
            />
          )}
          {!notification.read_at && (
            <Button
              label="Mark as read"
              variant="secondary"
              onPress={() => void markRead(notification.id)}
            />
          )}
        </Card>
      ))}
    </Screen>
  );
}
