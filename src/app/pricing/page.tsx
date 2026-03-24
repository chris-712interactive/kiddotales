import { Suspense } from "react";
import PricingContent from "./pricing-content";

function PricingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)] dark:from-[var(--pastel-pink)] dark:via-background dark:to-[var(--pastel-mint)]">
      <p className="text-sm text-muted-foreground">Loading pricing…</p>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<PricingFallback />}>
      <PricingContent />
    </Suspense>
  );
}
