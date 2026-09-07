import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@hatidone/mobile";
const icons = { index: "briefcase-outline", trips: "car-outline", earnings: "wallet-outline", account: "person-circle-outline" } as const;
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return <Tabs screenOptions={({ route }) => ({
    headerShown: false,
    tabBarActiveTintColor: theme.primary,
    tabBarInactiveTintColor: theme.muted,
    tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border, height: 60 + Math.max(insets.bottom, 8), paddingTop: 6, paddingBottom: Math.max(insets.bottom, 8) },
    tabBarLabelStyle: { fontSize: 12, fontWeight: "500" },
    tabBarIcon: ({ color, size }) => <Ionicons accessible={false} name={icons[route.name as keyof typeof icons]} color={color} size={size} />,
  })}>
    <Tabs.Screen name="index" options={{ title: "Jobs" }} />
    <Tabs.Screen name="trips" options={{ title: "Trips" }} />
    <Tabs.Screen name="earnings" options={{ title: "Earnings" }} />
    <Tabs.Screen name="account" options={{ title: "Account" }} />
  </Tabs>;
}
