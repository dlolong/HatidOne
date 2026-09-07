import { useState } from "react";
import { router } from "expo-router";
import { Screen, Heading, Muted, Row, Chip, Button } from "@hatidone/mobile";
import { useDriver } from "../../src/driver-context";
import { Feedback, RideCard, Empty } from "../../src/components";
import { ACTIVE_STATUSES } from "../../src/data";
import { dayGroup, label } from "../../src/format";
export default function TripsScreen() {
  const { data, loading, reload } = useDriver();
  const [tab, setTab] = useState("Today");
  const assignments = [...(data?.assignments ?? [])]
    .filter((item) =>
      tab === "History"
        ? !ACTIVE_STATUSES.includes(item.ride.status)
        : ACTIVE_STATUSES.includes(item.ride.status) &&
          (item.ride.status !== "assigned" ? tab === "Today" : dayGroup(item.ride.scheduled_at) === tab),
    )
    .sort(
      (a, b) =>
        Date.parse(a.ride.scheduled_at ?? "") -
        Date.parse(b.ride.scheduled_at ?? ""),
    );
  return (
    <Screen scrollKey={tab} refreshing={loading} onRefresh={() => void reload()}>
      <Muted>YOUR SCHEDULE</Muted>
      <Heading>Trips</Heading>
      <Feedback />
      <Row>
        {["Today", "Tomorrow", "Upcoming", "History"].map((value) => (
          <Chip
            key={value}
            label={value}
            selected={tab === value}
            onPress={() => setTab(value)}
          />
        ))}
      </Row>
      {!loading && !assignments.length && (
        <Empty
          action={<Button label="Find a job" variant="secondary" onPress={() => router.push("/(tabs)")} />}
          title={
            tab === "History"
              ? "No past trips yet"
              : `No trips ${tab === "Upcoming" ? "upcoming" : tab.toLowerCase()}`
          }
        >
          Accepted and assigned rides will appear here. Review Jobs for your
          next opportunity.
        </Empty>
      )}
      {assignments.map((item) => (
        <RideCard
          key={item.id}
          compact
          ride={item.ride}
          badge={label(item.ride.status)}
        >
          <Muted>
            {label(item.assignment_type)} assignment
          </Muted>
          <Muted>
            {ACTIVE_STATUSES.includes(item.ride.status) ? item.confirmed_at ? "Pickup confirmed." : "Pickup confirmation needed." : ""}
          </Muted>
          <Button
            label="Open trip"
            onPress={() => router.push(`/trip/${item.ride.id}`)}
          />
        </RideCard>
      ))}
    </Screen>
  );
}
