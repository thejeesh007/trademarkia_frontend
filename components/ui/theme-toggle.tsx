"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "tm_theme_v1";
type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial: Theme =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(initial);
    applyTheme(initial);
    setReady(true);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      className="theme-toggle fixed right-3 top-3 z-40 h-9 rounded-full px-3 text-xs font-semibold sm:right-5 sm:top-5"
      onClick={toggleTheme}
      disabled={!ready}
    >
      {theme === "light" ? "Dark" : "Light"}
    </button>
  );
}
