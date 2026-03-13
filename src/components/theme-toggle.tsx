"use client";

import { Moon, Sun } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  variant?: "default" | "drawer";
}

export function ThemeToggle({ className, variant = "default" }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();

  const handleToggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);

    if (session?.user) {
      fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      }).catch(() => {});
    }
  };

  if (variant === "drawer") {
    return (
      <Button
        variant="ghost"
        className={cn("w-full justify-start", className)}
        onClick={handleToggle}
        aria-label="Toggle theme"
      >
        {theme === "light" ? (
          <Moon className="mr-2 size-4" />
        ) : (
          <Sun className="mr-2 size-4" />
        )}
        {theme === "light" ? "Dark mode" : "Light mode"}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("size-10 shrink-0 rounded-full sm:size-9", className)}
      onClick={handleToggle}
      aria-label="Toggle theme"
    >
      <Sun className="size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
