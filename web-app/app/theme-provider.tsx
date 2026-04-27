"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeId = "dark" | "ocean" | "rose" | "light" | "mint";

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "mt:theme";

const applyThemeToDom = (t: ThemeId) => {
  if (typeof document === "undefined") return;
  if (t === "dark") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", t);
  }
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("ocean");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeId | null;
      if (saved === "dark" || saved === "ocean" || saved === "rose" || saved === "light" || saved === "mint") {
        setThemeState(saved);
        applyThemeToDom(saved);
      } else {
        setThemeState("ocean");
        applyThemeToDom("ocean");
      }
    } catch {
      setThemeState("ocean");
      applyThemeToDom("ocean");
    }
  }, []);

  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t);
    applyThemeToDom(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

