import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "@hatidone/mobile";
const icons = {
  index: "home-outline",
  bookings: "car-outline",
  activity: "notifications-outline",
  account: "person-outline",
} as const;
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: { minHeight: 66, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 12 },
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={icons[route.name as keyof typeof icons] ?? "ellipse-outline"}
            color={color}
            size={size}
          />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="bookings" options={{ title: "Bookings" }} />
      <Tabs.Screen name="activity" options={{ title: "Activity" }} />
      <Tabs.Screen name="account" options={{ title: "Account" }} />
    </Tabs>
  );
}
