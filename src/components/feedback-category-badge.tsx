"use client";

import { MessageSquare, Bug, Sparkles, HelpCircle } from "lucide-react";

const CATEGORY_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  general: { icon: MessageSquare, color: "text-blue-600", label: "General" },
  bug: { icon: Bug, color: "text-amber-600", label: "Bug" },
  feature: { icon: Sparkles, color: "text-violet-600", label: "Feature" },
  other: { icon: HelpCircle, color: "text-slate-500", label: "Other" },
};

const defaultConfig = { icon: MessageSquare, color: "text-muted-foreground", label: "General" };

export function FeedbackCategoryBadge({ category }: { category: string | null }) {
  const key = (category ?? "general").toLowerCase();
  const config = CATEGORY_CONFIG[key] ?? defaultConfig;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center ${config.color}`}
      title={config.label}
      aria-label={config.label}
    >
      <Icon className="size-4 shrink-0" />
    </span>
  );
}
