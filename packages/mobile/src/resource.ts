import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

export function useResource<T>(loader: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0); const loaderRef = useRef(loader); loaderRef.current = loader;
  const reload = useCallback(async () => { const request = ++sequence.current; setLoading(true); setError(null); try { const next = await loaderRef.current(); if (sequence.current === request) setData(next); } catch (reason) { if (sequence.current === request) setError(reason instanceof Error ? reason.message : 'Unable to load. Please retry.'); } finally { if (sequence.current === request) setLoading(false); } }, []);
  useEffect(() => { setData(null); void reload(); return () => { sequence.current++; }; }, [...deps, reload]);
  return { data, loading, error, reload };
}
