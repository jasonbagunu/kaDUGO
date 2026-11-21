import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

// All records now live in the database and are loaded through the API
// (see lib/api.ts and lib/useApi.ts). This context only keeps the small
// success/error message ("toast") that every page can show.
type ToastType = "success" | "error" | "warning";

interface ToastContextType {
  toast: { message: string; type: ToastType } | null;
  showToast: (message: string, type?: ToastType) => void;
}

const DataContext = createContext<ToastContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastContextType["toast"]>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return <DataContext.Provider value={{ toast, showToast }}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
