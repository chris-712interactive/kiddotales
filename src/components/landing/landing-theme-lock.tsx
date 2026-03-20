"use client";

import { useEffect } from "react";

const STORAGE_KEY = "kiddotales-theme";

/**
 * While mounted, keeps `dark` off `<html>` so the unauthenticated landing stays light.
 * ThemeProvider's mount effect runs after child effects and re-applies `dark` from
 * localStorage — this observer wins any race and blocks later toggles until unmount.
 */
export function LandingThemeLock() {
  useEffect(() => {
    const el = document.documentElement;

    const stripDark = () => {
      el.classList.remove("dark");
    };

    stripDark();

    const observer = new MutationObserver(() => {
      if (el.classList.contains("dark")) {
        stripDark();
      }
    });

    observer.observe(el, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
      const stored = localStorage.getItem(STORAGE_KEY);
      el.classList.toggle("dark", stored === "dark");
    };
  }, []);

  return null;
}
