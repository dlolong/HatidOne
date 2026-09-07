import { useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  AuthProvider,
  AuthScreen,
  useAuth,
  Screen,
  Notice,
  Button,
  Heading,
  Muted,
  theme,
  userError,
} from "@hatidone/mobile";
import { DriverProvider } from "../src/driver-context";
function DriverRoot() {
  const auth = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const signOut = () => {
    setSignOutError(null);
    void auth
      .signOut()
      .catch((reason) =>
        setSignOutError(
          userError(reason, "Unable to sign out. Please retry."),
        ),
      );
  };
  if (auth.loading)
    return (
      <Screen>
        <Heading>HatidOne Driver</Heading>
        <Muted>Restoring your session…</Muted>
      </Screen>
    );
  if (!auth.session)
    return (
      <AuthScreen
        title="HatidOne Driver"
        subtitle="Scheduled jobs. Clear earnings. Trips going your way."
        allowSignUp={false}
      />
    );
  if (auth.error || !auth.profile)
    return (
      <Screen>
        <Notice tone="error">
          {signOutError ??
            (auth.error ? userError(auth.error) : null) ??
            "Loading your driver profile. If this continues, retry below."}
        </Notice>
        <Button
          label="Retry profile"
          onPress={() => void auth.refreshProfile()}
        />
        <Button label="Sign out" variant="secondary" onPress={signOut} />
      </Screen>
    );
  if (auth.profile.role !== "driver")
    return (
      <Screen>
        <Heading>Driver account required</Heading>
        {signOutError && <Notice tone="error">{signOutError}</Notice>}
        <Muted>
          Sign in with your approved driver account. Passenger accounts use the
          separate HatidOne Passenger app.
        </Muted>
        <Button label="Sign out" onPress={signOut} />
      </Screen>
    );
  return (
    <DriverProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="trip/[id]" options={{ title: "Trip details" }} />
      </Stack>
    </DriverProvider>
  );
}
export default function RootLayout() {
  return (
    <AuthProvider
      supabaseUrl={process.env.EXPO_PUBLIC_SUPABASE_URL}
      supabaseAnonKey={process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}
    >
      <StatusBar style="dark" />
      <DriverRoot />
    </AuthProvider>
  );
}
