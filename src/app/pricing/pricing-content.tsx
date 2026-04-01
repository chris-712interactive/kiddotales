"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Sparkles,
  Zap,
  Crown,
  ArrowLeft,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppHeader } from "@/components/app-header";
import { UpgradeConfirmModal } from "@/components/upgrade-confirm-modal";
import { SUBSCRIPTION_TIERS, getTierRank } from "@/lib/stripe";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { getAffiliateCode } from "@/components/affiliate-ref-capture";

const TIER_ICONS: Record<string, React.ReactNode> = {
  free: <Sparkles className="size-5" />,
  spark: <Zap className="size-5" />,
  magic: <Sparkles className="size-5" />,
  legend: <Crown className="size-5" />,
};

export default function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState<string | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [priceIds, setPriceIds] = useState<{
    spark?: { monthly?: string; yearly?: string };
    magic?: { monthly?: string; yearly?: string };
    legend?: { monthly?: string; yearly?: string };
  } | null>(null);
  const [upgradeModal, setUpgradeModal] = useState<{
    priceId: string;
    tierName: string;
    amountFormatted: string;
  } | null>(null);
  const [upgradeConfirmLoading, setUpgradeConfirmLoading] = useState(false);
  const [giftLoadingKey, setGiftLoadingKey] = useState<string | null>(null);
  const [giftModal, setGiftModal] = useState<{
    tierId: "spark" | "magic" | "legend";
    tierName: string;
  } | null>(null);
  const [giftStep, setGiftStep] = useState<1 | 2 | 3>(1);
  const [giftPeriod, setGiftPeriod] = useState<"monthly" | "yearly">("monthly");
  const [giftRecipientEmail, setGiftRecipientEmail] = useState("");
  const [sendGiftEmailToRecipient, setSendGiftEmailToRecipient] = useState(false);
  const giftMode = searchParams.get("intent") === "gift";

  useEffect(() => {
    fetch("/api/stripe/price-ids")
      .then((r) => (r.ok ? r.json() : null))
      .then((ids) => setPriceIds(ids))
      .catch(() => setPriceIds(null));
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      setSubscriptionLoading(true);
      fetch("/api/user/settings")
        .then((r) => (r.ok ? r.json() : null))
        .then((res) => {
          setCurrentTier(res?.subscriptionTier ?? "free");
        })
        .catch(() => {
          setCurrentTier("free");
        })
        .finally(() => setSubscriptionLoading(false));
      const code = getAffiliateCode();
      if (code) {
        fetch("/api/user/affiliate-attribution", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ affiliateCode: code }),
          credentials: "include",
        }).catch(() => {});
      }
    } else {
      setCurrentTier(null);
      setSubscriptionLoading(false);
    }
  }, [status]);

  const handleSubscribe = async (priceId: string, tierId?: string) => {
    if (status !== "authenticated") {
      router.push(`/sign-in?callbackUrl=/pricing`);
      return;
    }
    if (subscriptionLoading) return;
    setLoadingPriceId(priceId);
    try {
      // Existing subscribers: upgrade shows modal, downgrade goes straight to change-plan
      if (currentTier && currentTier !== "free" && tierId) {
        const newTierRank = getTierRank(tierId);
        const currentTierRank = getTierRank(currentTier);

        if (newTierRank > currentTierRank) {
          // Upgrade: fetch preview and show modal
          const previewRes = await fetch("/api/stripe/preview-upgrade", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ priceId }),
          });
          const previewData = await previewRes.json();
          if (!previewRes.ok) throw new Error(previewData.error || "Failed to preview");
          const tierConfig = SUBSCRIPTION_TIERS[tierId as keyof typeof SUBSCRIPTION_TIERS];
          setUpgradeModal({
            priceId,
            tierName: tierConfig?.name ?? tierId,
            amountFormatted: previewData.amountFormatted ?? "$0.00",
          });
          return;
        }

        // Downgrade: no modal, apply immediately
        const res = await fetch("/api/stripe/change-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priceId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to change plan");
        toast.success(data.message ?? "Plan updated.");
        if (!data.effectiveAt) setCurrentTier(data.tier ?? currentTier);
        return;
      }

      // New subscribers: use checkout (include affiliate code if present)
      const affiliateCode = getAffiliateCode();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, affiliateCode: affiliateCode ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      if (data.url) window.location.href = data.url;
      else throw new Error("No checkout URL");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoadingPriceId(null);
    }
  };

  const handleUpgradeConfirm = async () => {
    if (!upgradeModal) return;
    setUpgradeConfirmLoading(true);
    try {
      const res = await fetch("/api/stripe/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: upgradeModal.priceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change plan");
      toast.success(data.message ?? "Plan upgraded.");
      setCurrentTier(data.tier ?? currentTier);
      setUpgradeModal(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upgrade");
    } finally {
      setUpgradeConfirmLoading(false);
    }
  };

  const handleGiftCheckout = async (
    tierId: "spark" | "magic" | "legend",
    period: "monthly" | "yearly"
  ) => {
    if (status !== "authenticated") {
      router.push(
        `/sign-in?callbackUrl=${encodeURIComponent(
          `/pricing?intent=gift&tier=${tierId}&period=${period}`
        )}`
      );
      return;
    }

    const key = `${tierId}-${period}`;
    setGiftLoadingKey(key);
    try {
      const res = await fetch("/api/stripe/gift-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: tierId,
          period,
          sendRecipientEmail: sendGiftEmailToRecipient,
          recipientEmail: sendGiftEmailToRecipient
            ? giftRecipientEmail.trim() || undefined
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gift checkout failed");
      if (data.url) window.location.href = data.url;
      else throw new Error("No checkout URL");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not start gift checkout"
      );
    } finally {
      setGiftLoadingKey(null);
    }
  };

  const openGiftFlow = (
    tierId: "spark" | "magic" | "legend",
    tierName: string,
    defaultPeriod: "monthly" | "yearly" = "monthly"
  ) => {
    setGiftModal({ tierId, tierName });
    setGiftStep(1);
    setGiftPeriod(defaultPeriod);
    setGiftRecipientEmail("");
    setSendGiftEmailToRecipient(false);
  };

  useEffect(() => {
    if (!giftMode) return;
    const tierParam = searchParams.get("tier");
    if (!tierParam || !["spark", "magic", "legend"].includes(tierParam)) return;
    const tierId = tierParam as "spark" | "magic" | "legend";
    const periodParam = searchParams.get("period");
    const period = periodParam === "yearly" ? "yearly" : "monthly";
    const tierName = SUBSCRIPTION_TIERS[tierId].name;
    openGiftFlow(tierId, tierName, period);
  }, [giftMode, searchParams]);

  const paidTiers = (["spark", "magic", "legend"] as const).map((tierId) => ({
    ...SUBSCRIPTION_TIERS[tierId],
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)] dark:from-[var(--pastel-pink)] dark:via-background dark:to-[var(--pastel-mint)]">
      <AppHeader
        className="shrink-0"
        pageActions={
          <Link href="/">
            <Button variant="ghost" size="sm" className="size-9 px-2 sm:size-auto sm:px-3" aria-label="Back">
              <ArrowLeft className="size-4 sm:mr-1" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          </Link>
        }
      />

      <main className="mx-auto min-h-0 w-full max-w-5xl flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8 [-webkit-overflow-scrolling:touch] md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <h1 className="text-3xl font-bold text-foreground md:text-4xl">
            Choose your plan
          </h1>
          <p className="mt-2 text-muted-foreground">
            Unlock more stories and features for your little ones
          </p>
        </motion.div>

        {giftMode && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="mx-auto mt-6 max-w-2xl rounded-2xl border-2 border-primary/40 bg-primary/5 p-4"
          >
            <p className="text-sm font-semibold text-foreground">
              Gift mode: pick a plan below to gift a membership.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;ll get a step-by-step gift flow after selecting a plan.
            </p>
            <div className="mt-3">
              <Button
                size="sm"
                onClick={() => openGiftFlow("spark", SUBSCRIPTION_TIERS.spark.name)}
              >
                Start guided gift flow
              </Button>
            </div>
          </motion.div>
        )}

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {/* Free tier */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="relative flex h-full flex-col rounded-2xl border-2 border-border bg-card p-6 shadow-sm">
              {currentTier === "free" && (
                <span className="absolute right-4 top-4 rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary">
                  Current plan
                </span>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                {TIER_ICONS.free}
                <span className="font-semibold">{SUBSCRIPTION_TIERS.free.name}</span>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold">Free</span>
              </div>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
                {SUBSCRIPTION_TIERS.free.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/create" className="mt-6">
                <Button variant="outline" className="w-full">
                  Get started
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Paid tiers */}
          {paidTiers.map((tier, idx) => {
            const tierPriceIds = priceIds?.[tier.id as keyof typeof priceIds];
            const priceIdMonthly = tierPriceIds?.monthly;
            const priceIdYearly = tierPriceIds?.yearly;
            const hasPrices = !!(priceIdMonthly || priceIdYearly);

            return (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 + (idx + 1) * 0.05 }}
              >
                <div
                  className={`relative flex h-full flex-col rounded-2xl border-2 p-6 shadow-sm ${
                    tier.id === "legend"
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card"
                  }`}
                >
                  {currentTier === tier.id && (
                    <span className="absolute right-4 top-4 rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary">
                      Current plan
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    {TIER_ICONS[tier.id]}
                    <span className="font-semibold">{tier.name}</span>
                  </div>
                  <div className="mt-4">
                    <span className="text-3xl font-bold">
                      ${tier.priceMonthly}
                    </span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    or ${tier.priceYearly}/year (save 17%)
                  </p>
                  <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
                    {tier.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {status === "authenticated" && hasPrices ? (
                    <div className="mt-6 space-y-2">
                      <Button
                        className="w-full"
                        disabled={
                          subscriptionLoading ||
                          !!loadingPriceId ||
                          currentTier === tier.id
                        }
                        onClick={() =>
                          handleSubscribe(priceIdMonthly || priceIdYearly!, tier.id)
                        }
                      >
                        {loadingPriceId === (priceIdMonthly || priceIdYearly) ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : subscriptionLoading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          "Subscribe monthly"
                        )}
                      </Button>
                      {priceIdYearly && (
                        <Button
                          variant="outline"
                          className="w-full"
                          disabled={
                            subscriptionLoading ||
                            !!loadingPriceId ||
                            currentTier === tier.id
                          }
                          onClick={() => handleSubscribe(priceIdYearly, tier.id)}
                        >
                          {loadingPriceId === priceIdYearly ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : subscriptionLoading ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            "Subscribe yearly"
                          )}
                        </Button>
                      )}
                      <div className="pt-2">
                        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                          Gift this plan
                        </p>
                        <Button
                          variant="secondary"
                          className="w-full"
                          disabled={!!giftLoadingKey}
                          onClick={() =>
                            openGiftFlow(
                              tier.id as "spark" | "magic" | "legend",
                              tier.name
                            )
                          }
                        >
                          Gift this plan
                        </Button>
                      </div>
                    </div>
                  ) : status === "authenticated" ? (
                    <Button
                      className="mt-6 w-full"
                      variant="outline"
                      disabled={subscriptionLoading || currentTier === tier.id}
                      onClick={() =>
                        toast.error("Stripe prices not configured. Add price IDs to .env")
                      }
                    >
                      Subscribe (configure Stripe)
                    </Button>
                  ) : (
                    <div className="mt-6 space-y-2">
                      <Link href="/sign-in?callbackUrl=/pricing" className="block">
                        <Button className="w-full">Sign in to subscribe</Button>
                      </Link>
                      <Link
                        href={`/sign-in?callbackUrl=${encodeURIComponent(
                          `/pricing?intent=gift&tier=${tier.id}&period=monthly`
                        )}`}
                        className="block"
                      >
                        <Button variant="outline" className="w-full">
                          Sign in to gift this plan
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Secure checkout powered by Stripe. Cancel anytime.
        </p>

        {upgradeModal && (
          <UpgradeConfirmModal
            isOpen={!!upgradeModal}
            onClose={() => setUpgradeModal(null)}
            tierName={upgradeModal.tierName}
            amountFormatted={upgradeModal.amountFormatted}
            onConfirm={handleUpgradeConfirm}
            isLoading={upgradeConfirmLoading}
          />
        )}

        <AnimatePresence>
          {giftModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onClick={() => setGiftModal(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md rounded-2xl border-2 border-border bg-card p-6 shadow-xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="gift-flow-title"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 id="gift-flow-title" className="text-xl font-semibold text-foreground">
                      Gift {giftModal.tierName}
                    </h2>
                    <p className="text-sm text-muted-foreground">Step {giftStep} of 3</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setGiftModal(null)}
                    aria-label="Close gift flow"
                  >
                    <X className="size-5" />
                  </Button>
                </div>

                {giftStep === 1 ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Choose which plan you want to gift.
                    </p>
                    <div className="grid gap-2">
                      {(["spark", "magic", "legend"] as const).map((tierId) => (
                        <Button
                          key={tierId}
                          variant={giftModal.tierId === tierId ? "default" : "outline"}
                          className="justify-start"
                          onClick={() =>
                            setGiftModal({
                              tierId,
                              tierName: SUBSCRIPTION_TIERS[tierId].name,
                            })
                          }
                        >
                          {SUBSCRIPTION_TIERS[tierId].name}
                        </Button>
                      ))}
                    </div>
                    <div className="pt-2">
                      <Button className="w-full" onClick={() => setGiftStep(2)}>
                        Next
                      </Button>
                    </div>
                  </div>
                ) : giftStep === 2 ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Choose how long you want the gift membership to last.
                    </p>
                    <div className="grid gap-2">
                      <Button
                        variant={giftPeriod === "monthly" ? "default" : "outline"}
                        className="justify-start"
                        onClick={() => setGiftPeriod("monthly")}
                      >
                        1 month gift
                      </Button>
                      <Button
                        variant={giftPeriod === "yearly" ? "default" : "outline"}
                        className="justify-start"
                        onClick={() => setGiftPeriod("yearly")}
                      >
                        1 year gift
                      </Button>
                    </div>
                    <div className="pt-2">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setGiftStep(1)}
                        >
                          Back
                        </Button>
                        <Button className="flex-1" onClick={() => setGiftStep(3)}>
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Choose whether we should email the recipient directly.
                    </p>
                    <label className="flex items-start gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={sendGiftEmailToRecipient}
                        onChange={(e) => setSendGiftEmailToRecipient(e.target.checked)}
                      />
                      Email the recipient their gift code now
                    </label>
                    {sendGiftEmailToRecipient && (
                      <Input
                        type="email"
                        placeholder="Recipient email"
                        value={giftRecipientEmail}
                        onChange={(e) => setGiftRecipientEmail(e.target.value)}
                      />
                    )}
                    <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">Gift summary:</span>{" "}
                        {giftModal.tierName} • {giftPeriod === "yearly" ? "1 year" : "1 month"}
                      </p>
                      <p className="mt-1">
                        Recipient email:{" "}
                        {sendGiftEmailToRecipient
                          ? (giftRecipientEmail.trim() || "(missing)")
                          : "No (purchaser only)"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setGiftStep(2)}
                        disabled={!!giftLoadingKey}
                      >
                        Back
                      </Button>
                      <Button
                        className="flex-1"
                        disabled={!!giftLoadingKey}
                        onClick={() => {
                          if (
                            sendGiftEmailToRecipient &&
                            !giftRecipientEmail.trim()
                          ) {
                            toast.error("Please enter recipient email or uncheck email option.");
                            return;
                          }
                          handleGiftCheckout(giftModal.tierId, giftPeriod);
                        }}
                      >
                        {giftLoadingKey === `${giftModal.tierId}-${giftPeriod}` ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          "Continue to checkout"
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
