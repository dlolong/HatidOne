import { AppState } from "react-native";
import { userError } from "./errors";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DependencyList,
} from "react";

export function useResource<T>(loader: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lifecycle = useRef<{ sequence: number; deps: DependencyList | null }>({
    sequence: 0,
    deps: null,
  });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const reload = useCallback(async () => {
    const request = ++lifecycle.current.sequence;
    setLoading(true);
    try {
      const next = await loaderRef.current();
      if (lifecycle.current.sequence === request) {
        setData(next);
        setError(null);
        setUpdatedAt(Date.now());
      }
    } catch (reason) {
      if (lifecycle.current.sequence === request)
        setError(
          userError(reason, "We couldn’t load this information. Pull down to refresh or try again."),
        );
    } finally {
      if (lifecycle.current.sequence === request) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const previous = lifecycle.current.deps;
    if (
      !previous ||
      previous.length !== deps.length ||
      deps.some((value, index) => !Object.is(value, previous[index]))
    ) {
      lifecycle.current.deps = [...deps];
      setData(null);
      setUpdatedAt(null);
      void reload();
    }
  }, [deps, reload]);
  useEffect(() => {
    const current = lifecycle.current;
    return () => {
      current.sequence++;
      current.deps = null;
    };
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void reload();
    });
    // Covers reconnects on native without requiring a new connectivity dependency.
    // Reads only: never replay a mutation after a reconnect.
    const timer = setInterval(() => {
      if (AppState.currentState === "active" || AppState.currentState === null) void reload();
    }, 30000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, [reload]);
  const sameAccount = lifecycle.current.deps !== null && lifecycle.current.deps.length === deps.length && deps.every((value, index) => Object.is(value, lifecycle.current.deps![index]));
  return { data: sameAccount ? data : null, loading, error, reload, updatedAt, stale: !!error || (updatedAt !== null && Date.now() - updatedAt > 60000) };
}
