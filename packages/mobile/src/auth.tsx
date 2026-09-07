import "react-native-url-polyfill/auto";
import {
  createClient,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Button, Card, Field, Heading, Muted, Notice, Screen } from "./ui";

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
}: {
  children: ReactNode;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}) {
  const client = useMemo(
    () =>
      supabaseUrl && supabaseAnonKey
        ? createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
              storage,
              autoRefreshToken: true,
              persistSession: true,
              detectSessionInUrl: false,
            },
          })
        : null,
    [supabaseUrl, supabaseAnonKey],
  );
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
      setError(result.error.message);
      return;
    }
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
          setSession(data.session);
          setError(authError?.message ?? null);
          setLoading(false);
        }
      })
      .catch((reason: unknown) => {
        if (live) {
          setError(
            reason instanceof Error ? reason.message : "Session restore failed",
          );
          setLoading(false);
        }
      });
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") client.auth.startAutoRefresh();
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
            setError(result.error?.message ?? null);
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
        profile,
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
          if (result.error) throw new Error(result.error.message);
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
          if (result.error) throw new Error(result.error.message);
          return result.data.session
            ? "Account created."
            : "Check your email to confirm your account, then sign in.";
        },
        signOut: async () => {
          if (!client) return;
          const result = await client.auth.signOut();
          if (result.error) throw new Error(result.error.message);
          setProfile(null);
        },
      }}
    >
      {children}
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
}: {
  title: string;
  subtitle?: string;
  allowSignUp?: boolean;
}) {
  const auth = useAuth();
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
      <Muted>{subtitle ?? "Reliable rides. A driver-first network."}</Muted>
      {!auth.configured && (
        <Notice>
          Connect your existing Supabase project using EXPO_PUBLIC_SUPABASE_URL
          and EXPO_PUBLIC_SUPABASE_ANON_KEY in this app’s .env file. No maps,
          SMS, or payment credentials are required.
        </Notice>
      )}
      <Card>
        <Heading>{signup ? "Create account" : "Welcome back"}</Heading>
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
      <Muted>
        Your account and trips are stored in Supabase. There is no simulated
        login.
      </Muted>
    </Screen>
  );
}
