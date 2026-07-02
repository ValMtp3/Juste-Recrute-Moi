// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Vasudev Siddh and vasu-devs

import { useEffect, useState } from "react";
import { readLocalStorage, writeLocalStorage } from "./storage";

export type ThemePref = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "jhm-theme";

const SYSTEM_DARK = "(prefers-color-scheme: dark)";

export function getStoredPref(): ThemePref {
  const value = readLocalStorage(THEME_KEY);
  if (value === "light" || value === "dark" || value === "system") return value;
  return "system";
}

export function systemTheme(): ResolvedTheme {
  return typeof window !== "undefined" && window.matchMedia(SYSTEM_DARK).matches ? "dark" : "light";
}

export function resolveTheme(pref: ThemePref): ResolvedTheme {
  return pref === "system" ? systemTheme() : pref;
}

/** Apply the resolved theme to <html> so the CSS token overrides take effect. */
export function applyTheme(pref: ThemePref): ResolvedTheme {
  const resolved = resolveTheme(pref);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  return resolved;
}

/**
 * Wire up theming once at app start: apply the stored preference and, while the
 * preference is "system", keep following OS light/dark changes live. Mirrors the
 * inline bootstrap in index.html (which runs first to avoid a flash of the wrong
 * theme); this re-applies after hydration and adds the live system listener.
 */
export function initTheme(): void {
  applyTheme(getStoredPref());
  if (typeof window === "undefined" || !window.matchMedia) return;
  window.matchMedia(SYSTEM_DARK).addEventListener("change", () => {
    if (getStoredPref() === "system") applyTheme("system");
  });
}

/** React hook for reading and changing the theme preference. */
export function useTheme() {
  const [pref, setPrefState] = useState<ThemePref>(getStoredPref);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(getStoredPref()));

  const setPref = (next: ThemePref) => {
    writeLocalStorage(THEME_KEY, next);
    setPrefState(next);
    setResolved(applyTheme(next));
  };

  // Follow OS changes while on "system" so the hook's `resolved` stays accurate.
  useEffect(() => {
    if (pref !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(SYSTEM_DARK);
    const onChange = () => setResolved(applyTheme("system"));
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [pref]);

  return { pref, resolved, setPref };
}
