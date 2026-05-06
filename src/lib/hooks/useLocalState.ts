import { useEffect, useState } from "react";

/**
 * Custom hook para sincronizar estado com localStorage
 * Útil para persistir dados entre sessões
 */
export function useLocalState<T>(key: string, fallback: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return fallback;
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState] as const;
}
