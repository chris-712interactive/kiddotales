"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "@/components/theme-provider";

/** When user is logged in, fetches their saved theme from the DB and applies it. */
export function ThemeSync() {
  const { data: session, status } = useSession();
  const { setTheme } = useTheme();
  const appliedRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) {
      appliedRef.current = false;
      return;
    }
    if (appliedRef.current) return;

    fetch("/api/user/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.theme && (data.theme === "light" || data.theme === "dark")) {
          appliedRef.current = true;
          setTheme(data.theme);
        }
      })
      .catch(() => {});
  }, [status, session?.user, setTheme]);

  return null;
}
