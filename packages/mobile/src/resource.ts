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
    setError(null);
    try {
      const next = await loaderRef.current();
      if (lifecycle.current.sequence === request) setData(next);
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
  return { data, loading, error, reload };
}
