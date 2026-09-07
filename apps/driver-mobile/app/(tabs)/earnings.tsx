import { useMemo, useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import {
  Screen,
  Heading,
  Muted,
  Card,
  Row,
  Chip,
  Button,
  theme,
} from "@hatidone/mobile";
import { Feedback, MoneyLine, Empty } from "../../src/components";
import { useDriver } from "../../src/driver-context";
import { schedule, peso } from "../../src/format";
export default function EarningsScreen() {
  const { data, loading, reload } = useDriver();
  const [period, setPeriod] = useState("Today");
  const rows = useMemo(
    () =>
      (data?.earnings ?? []).filter((row) => {
        if (period === "All time") return true;
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        if (period === "This week")
          start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
        return Date.parse(row.completed_at) >= start.getTime();
      }),
    [data, period],
  );
  const total = (
    field: "gross_fare" | "platform_commission" | "driver_earnings",
  ): number | null =>
    rows.some((row) => row[field] === null)
      ? null
      : rows.reduce((sum, row) => sum + Number(row[field] ?? 0), 0);
  return (
    <Screen scrollKey={period} refreshing={loading} onRefresh={() => void reload()}>
      <Muted>TRANSPARENT EARNINGS</Muted>
      <Heading>Your earnings</Heading>
      <Feedback />
      <Row>
        {["Today", "This week", "All time"].map((value) => (
          <Chip
            key={value}
            label={value}
            selected={period === value}
            onPress={() => setPeriod(value)}
          />
        ))}
      </Row>
      <Card>
        <Muted>Estimated earnings · {period.toLowerCase()}</Muted>
        <Text style={{ fontSize: 36, fontWeight: "600", color: theme.text }}>{peso(total("driver_earnings"))}</Text>
        <Muted>{rows.length} completed trip{rows.length === 1 ? "" : "s"}</Muted>
        <MoneyLine label="Gross fare" value={total("gross_fare")} />
        <MoneyLine
          label="HatidOne commission"
          value={total("platform_commission")}
        />
        <MoneyLine
          label="Estimated take-home"
          value={total("driver_earnings")}
          strong
        />
        <Muted>
          No separate adjustments recorded. Tolls, taxes and collection costs may affect the final amount. This is not a payout balance.
        </Muted>
      </Card>

      {!loading && !rows.length && (
        <Empty title="Your next trip starts here" action={<Button label="Find a job" onPress={() => router.push("/(tabs)")} />}>
          Complete a ride to see its fare and commission breakdown.
        </Empty>
      )}
      {rows.map((row) => (
        <Card key={row.id}>
          <Muted>{schedule(row.completed_at)}</Muted>
          <MoneyLine label="Gross fare" value={row.gross_fare} />
          <MoneyLine
            label="HatidOne commission"
            value={row.platform_commission}
          />
          <MoneyLine
            label="Estimated take-home"
            value={row.driver_earnings}
            strong
          />
          <Button
            label="View completed trip"
            variant="secondary"
            onPress={() => router.push(`/trip/${row.ride_request_id}`)}
          />
        </Card>
      ))}
    </Screen>
  );
}
