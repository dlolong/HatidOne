import { useCallback, useEffect, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  Button,
  Card,
  Heading,
  LoadingSkeleton,
  StatusPill,
  userError,
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
  const [visibleCount, setVisibleCount] = useState(20);
  const resource = useResource(
    () => getNotifications(client, session?.user.id),
    [client, session?.user.id],
  );
  const { reload } = resource;
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
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
        () => void reload(),
      )
      .subscribe();
    const timer = setInterval(() => void reload(), 20000);
    return () => {
      clearInterval(timer);
      void client.removeChannel(channel);
    };
  }, [client, session, reload]);
  async function markRead(id: string) {
    if (!client) return;
    const result = await client.rpc("mark_notification_read", {
      p_notification_id: id,
    });
    if (result.error)
      setError(
        userError(
          result.error,
          "We couldn’t mark this update as read. Please try again.",
        ),
      );
    else {
      setError("");
      await reload();
    }
  }
  return (
    <Screen refreshing={resource.loading} onRefresh={() => void reload()}>
      <Heading>Activity</Heading>
      <Muted>Booking updates and messages, all in one place.</Muted>
      {(error || resource.error) && (
        <Notice tone="error">
          {error || "We couldn’t load your updates. Pull down to try again."}
        </Notice>
      )}
      {resource.loading && !resource.data && <LoadingSkeleton lines={4} />}
      {resource.data?.length === 0 && (
        <Card>
          <Heading size="section">You’re all caught up</Heading>
          <Muted>Booking and driver updates will appear here.</Muted>
        </Card>
      )}
      {resource.data?.slice(0, visibleCount).map((notification) => (
        <Card key={notification.id}>
          {!notification.read_at && <StatusPill label="New update" />}
          <Heading size="section">{notification.title}</Heading>
          <Muted>{dateTime(notification.created_at)}</Muted>
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
      {resource.data && resource.data.length > visibleCount && (
        <Button
          label="Show more updates"
          variant="secondary"
          onPress={() => setVisibleCount((value) => value + 20)}
        />
      )}
    </Screen>
  );
}
