import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "./api";

// Loads data from the backend for a screen. Pass null to skip loading.
// Only the newest request is allowed to update the screen, so a slow older
// response (for example an earlier search) can never overwrite a newer one.
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [error, setError] = useState("");
  const latest = useRef(0);

  const load = useCallback(async () => {
    if (path === null) return;
    const id = ++latest.current;
    setLoading(true);
    try {
      const result = await api<T>(path);
      if (id !== latest.current) return;
      setData(result);
      setError("");
    } catch (e) {
      if (id !== latest.current) return;
      setError(errorMessage(e));
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    if (path === null) {
      latest.current++;
      setData(null);
      setLoading(false);
      return;
    }
    void load();
  }, [path, load]);

  return { data, loading, error, reload: load };
}

// Waits until the value has stopped changing, so typing in a search box does
// not send one request per keystroke.
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
