import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "pl:theme";

function apply(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

/** Persisted light/dark theme, shared across the app via localStorage + a custom event. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const stored = localStorage.getItem(KEY) as Theme | null;
    const initial: Theme =
      stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setThemeState(initial);
    apply(initial);

    const onChange = (e: Event) => setThemeState((e as CustomEvent<Theme>).detail);
    window.addEventListener("pl:theme-change", onChange);
    return () => window.removeEventListener("pl:theme-change", onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(KEY, next);
    apply(next);
    setThemeState(next);
    window.dispatchEvent(new CustomEvent("pl:theme-change", { detail: next }));
  }, []);

  const toggle = useCallback(
    () => setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark"),
    [setTheme],
  );

  return { theme, setTheme, toggle };
}
