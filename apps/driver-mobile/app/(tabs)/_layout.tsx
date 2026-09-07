import { Tabs } from "expo-router";
import { Text } from "react-native";
const icons: Record<string, string> = {
  index: "↗",
  trips: "▤",
  earnings: "₱",
  account: "◎",
};
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#12624f",
        tabBarInactiveTintColor: "#697a74",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e0e9e4",
          height: 84,
          paddingTop: 8,
          paddingBottom: 22,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        tabBarIcon: ({ color }) => (
          <Text accessibilityElementsHidden style={{ fontSize: 25, color }}>
            {icons[route.name]}
          </Text>
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Jobs" }} />
      <Tabs.Screen name="trips" options={{ title: "Trips" }} />
      <Tabs.Screen name="earnings" options={{ title: "Earnings" }} />
      <Tabs.Screen name="account" options={{ title: "Account" }} />
    </Tabs>
  );
}
