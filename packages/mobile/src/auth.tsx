import "react-native-url-polyfill/auto";
import { signupOutcome } from "@hatidone/core";
import {
  createClient,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform, View, Text, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { Button, Card, Field, Heading, Muted, Notice, Screen } from "./ui";
import { userError } from "./errors";
import { passwordRecoveryUrl } from "./public-url.cjs";

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  phone_verified: boolean;
  account_status: string;
}
interface AuthContextValue {
  client: SupabaseClient | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) => Promise<string>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);
// SecureStore is native-only. Web uses the browser's origin-isolated storage;
// SSR reads return null, and disabled browser storage surfaces a useful auth error.
const storage = {
  getItem: async (key: string) =>
    Platform.OS === "web"
      ? typeof localStorage === "undefined"
        ? null
        : localStorage.getItem(key)
      : SecureStore.getItemAsync(key),
  setItem: async (key: string, value: string) => {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
    } else await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") localStorage.removeItem(key);
    } else await SecureStore.deleteItemAsync(key);
  },
};
export function AuthProvider({
  children,
  supabaseUrl,
  supabaseAnonKey,
  environment,
}: {
  children: ReactNode;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  environment?: string;
}) {
  const client = useMemo(() => {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    try {
      return createClient(supabaseUrl, supabaseAnonKey, {
        auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      });
    } catch { return null; }
  }, [supabaseUrl, supabaseAnonKey]);
  const activeUser = useRef<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  async function refreshProfile() {
    if (!client || !session) {
      setProfile(null);
      return;
    }
    const result = await client
      .from("profiles")
      .select(
        "id,first_name,last_name,email,phone,role,phone_verified,account_status",
      )
      .eq("id", session.user.id)
      .single();
    if (result.error) {
      setError(userError(result.error));
      return;
    }
    if (activeUser.current !== session.user.id) return;
    setProfile(result.data);
    setError(null);
  }
  useEffect(() => {
    if (!client) {
      setLoading(false);
      return;
    }
    let live = true;
    client.auth
      .getSession()
      .then(({ data, error: authError }) => {
        if (live) {
          activeUser.current = data.session?.user.id ?? null;
          setSession(data.session);
          setError(authError ? userError(authError) : null);
          setLoading(false);
        }
      })
      .catch((reason: unknown) => {
        if (live) {
          setError(
            userError(reason, "We couldn’t restore your session. Sign in again."),
          );
          setLoading(false);
        }
      });
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      activeUser.current = next?.user.id ?? null;
      setProfile((current) => current?.id === next?.user.id ? current : null);
      setSession(next);
      setLoading(false);
    });
    const verifySession = async () => {
      const { data: current } = await client.auth.getSession();
      if (!current.session) return;
      const result = await client.auth.getUser();
      // Network outages are not revocations. Only an authoritative auth rejection clears storage.
      if (result.error && result.error.status && [400, 401, 403].includes(result.error.status)) {
        const latest = await client.auth.getSession();
        if (live && latest.data.session?.access_token === current.session.access_token) await client.auth.signOut({ scope: "local" });
      }
    };
    if (AppState.currentState === "active") client.auth.startAutoRefresh();
    void verifySession().catch(() => undefined);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        client.auth.startAutoRefresh();
        void verifySession().catch(() => undefined);
      }
      else client.auth.stopAutoRefresh();
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
      subscription.remove();
      client.auth.stopAutoRefresh();
    };
  }, [client]);
  const profileUserId = session?.user.id;
  useEffect(() => {
    let live = true;
    setProfile(null);
    if (client && profileUserId)
      client
        .from("profiles")
        .select(
          "id,first_name,last_name,email,phone,role,phone_verified,account_status",
        )
        .eq("id", profileUserId)
        .single()
        .then((result) => {
          if (live) {
            setProfile(result.data);
            setError(result.error ? userError(result.error) : null);
          }
        });
    return () => {
      live = false;
    };
  }, [client, profileUserId]);
  return (
    <AuthContext.Provider
      value={{
        client,
        session,
        profile: profile?.id === session?.user.id ? profile : null,
        loading,
        configured: !!client,
        error,
        refreshProfile,
        signIn: async (email, password) => {
          if (!client)
            throw new Error(
              "Configure the public Supabase URL and anon key first.",
            );
          const result = await client.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (result.error) throw new Error(userError(result.error));
        },
        signUp: async (email, password, firstName, lastName) => {
          if (!client) throw new Error("Supabase is not configured.");
          const result = await client.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
              },
            },
          });
          if (result.error) throw new Error(userError(result.error));
          const outcome = signupOutcome(result);
          if (outcome === "failed") throw new Error("Signup could not be completed. Retry, or sign in with your existing account.");
          // The SDK's existing auth event/storage mechanism handles sessions.
          return outcome === "authenticated"
            ? "Signed in."
            : "If confirmation is needed and delivery is available, check your email, then sign in. Already registered? Sign in or reset your password.";
        },
        signOut: async () => {
          if (!client) return;
          const result = await client.auth.signOut({ scope: "local" });
          if (result.error) throw new Error(userError(result.error));
          activeUser.current = null;
          setSession(null);
          setProfile(null);
        },
      }}
    >
      <View style={{ flex: 1 }}>
        {environment && environment !== "production" && <SafeAreaView edges={["top"]} style={{ backgroundColor: "#111111" }}><Text style={{ backgroundColor: "#111111", color: "#FFFFFF", textAlign: "center", paddingTop: 8, paddingBottom: 8 }}>{environment === "staging" ? "Invited staging software test" : `${environment.toUpperCase()} · Fictional testing only`}</Text></SafeAreaView>}
        {children}
      </View>
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
export function AuthScreen({
  title,
  subtitle,
  allowSignUp = true,
  webUrl,
  environment,
}: {
  title: string;
  subtitle?: string;
  allowSignUp?: boolean;
  webUrl?: string;
  environment?: string;
}) {
  const auth = useAuth();
  const recoveryUrl = passwordRecoveryUrl(webUrl, environment);
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function submit() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (signup)
        setMessage(await auth.signUp(email, password, firstName, lastName));
      else await auth.signIn(email, password);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to authenticate",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Heading>{title}</Heading>
      <Muted>{subtitle ?? "A simpler way to get there."}</Muted>
      {!auth.configured && (
        <Notice>
          Connect your existing Supabase project using EXPO_PUBLIC_SUPABASE_URL
          and EXPO_PUBLIC_SUPABASE_ANON_KEY in this app’s .env file. No maps,
          SMS, or payment credentials are required.
        </Notice>
      )}
      <Card>
        <Heading size="section">{signup ? "Create your account" : "Welcome back"}</Heading>
        {signup && (
          <>
            <Field
              label="First name"
              value={firstName}
              onChangeText={setFirstName}
              autoComplete="given-name"
            />
            <Field
              label="Last name"
              value={lastName}
              onChangeText={setLastName}
              autoComplete="family-name"
            />
          </>
        )}
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={signup ? "new-password" : "current-password"}
          hint={signup ? "At least 8 characters. Use a password you don’t use elsewhere." : undefined}
        />
        {(error || auth.error) && (
          <Notice tone="error">{error || auth.error}</Notice>
        )}
        {message && <Notice tone="success">{message}</Notice>}
        <Button
          label={signup ? "Create passenger account" : "Sign in"}
          loading={busy}
          disabled={
            !auth.configured ||
            !email.trim() ||
            !password ||
            (signup && (password.length < 8 || !firstName.trim()))
          }
          onPress={() => void submit()}
        />
        {!signup && (recoveryUrl ? <>
          <Button label="Forgot password" variant="secondary" disabled={busy} onPress={() => {
            setError("");
            void Linking.openURL(recoveryUrl).catch(() => setError("We couldn’t open password recovery. Try again or open your HatidOne web account in your browser."));
          }} />
          <Muted>Password recovery opens in your browser. Complete the web instructions, then return here to sign in. Email delivery has not been verified.</Muted>
        </> : <Muted>Password recovery is unavailable in this build. Contact the person who invited you for account assistance.</Muted>)}
        {allowSignUp && (
          <Button
            label={signup ? "I already have an account" : "Create an account"}
            variant="secondary"
            onPress={() => {
              setSignup(!signup);
              setError("");
              setMessage("");
            }}
          />
        )}
      </Card>
      <Muted>Sign in securely to manage your rides and account.</Muted>
    </Screen>
  );
}
