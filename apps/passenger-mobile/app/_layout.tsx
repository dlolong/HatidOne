import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  AuthProvider,
  AuthScreen,
  Button,
  Heading,
  LoadingSkeleton,
  userError,
  Notice,
  Screen,
  useAuth,
} from "@hatidone/mobile";
function AppContent() {
  const auth = useAuth();
  if (auth.loading)
    return (
      <Screen>
        <Heading>HatidOne</Heading>
        <LoadingSkeleton lines={4} />
      </Screen>
    );
  if (!auth.session)
    return (
      <AuthScreen
        title="HatidOne"
        subtitle="Your next ride, reliably arranged."
      />
    );
  if (!auth.profile)
    return (
      <Screen>
        <Heading>Loading your profile</Heading>
        <Notice tone={auth.error ? "error" : "info"}>
          {auth.error
            ? userError(auth.error, "We couldn’t load your profile. Try again.")
            : "Connecting to your passenger account…"}
        </Notice>
        <Button
          label="Retry profile"
          onPress={() => void auth.refreshProfile()}
        />
        <Button
          label="Sign out"
          variant="secondary"
          onPress={() => void auth.signOut()}
        />
      </Screen>
    );
  if (auth.profile.role !== "passenger")
    return (
      <Screen>
        <Heading>Passenger app</Heading>
        <Notice>
          Your account is registered as {auth.profile.role}. Use the appropriate
          HatidOne app for this account.
        </Notice>
        <Button label="Sign out" onPress={() => void auth.signOut()} />
      </Screen>
    );
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="book"
          options={{ presentation: "fullScreenModal" }}
        />
        <Stack.Screen name="booking/[id]" />
      </Stack>
    </>
  );
}
export default function Layout() {
  return (
    <AuthProvider
      supabaseUrl={process.env.EXPO_PUBLIC_SUPABASE_URL}
      supabaseAnonKey={process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}
    >
      <AppContent />
    </AuthProvider>
  );
}
