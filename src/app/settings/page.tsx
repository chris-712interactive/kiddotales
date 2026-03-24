"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, User, Phone, BookOpen, Sparkles, ExternalLink, Loader2, Shield, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AppHeader } from "@/components/app-header";
import { FeedbackTrigger } from "@/components/feedback-trigger";
import { getBookLimitForTier } from "@/lib/stripe";
import { toast } from "sonner";

type SettingsData = {
  profile: {
    id: string;
    email: string | null;
    displayName: string | null;
    phone: string | null;
    subscriptionTier: string;
    theme?: "light" | "dark";
    name: string | null;
    image: string | null;
    parentConsentAt?: string | null;
  };
  bookCount: number;
  bookLimit: number;
  bookLimitPeriod?: "total" | "monthly";
  subscriptionTier: string;
  theme?: "light" | "dark";
};

type FeedbackTicket = {
  id: string;
  category: string | null;
  status: "new" | "in_review" | "resolved";
  created_at: string;
  updated_at: string | null;
  unread_for_user: boolean;
};

type FeedbackMessage = {
  id: string;
  sender_role: "user" | "admin";
  sender_email: string | null;
  message: string;
  created_at: string;
};

type GiftMembership = {
  id: string;
  code: string;
  tier: "spark" | "magic" | "legend";
  durationMonths: number;
  status: "purchased" | "redeemed" | "expired" | "cancelled";
  recipientEmail: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

function SettingsContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [giftCode, setGiftCode] = useState("");
  const [redeemingGift, setRedeemingGift] = useState(false);
  const [giftTier, setGiftTier] = useState<"spark" | "magic" | "legend">("spark");
  const [giftPeriod, setGiftPeriod] = useState<"monthly" | "yearly">("monthly");
  const [giftRecipientEmail, setGiftRecipientEmail] = useState("");
  const [giftCheckoutLoading, setGiftCheckoutLoading] = useState(false);
  const [myGifts, setMyGifts] = useState<GiftMembership[]>([]);
  const [resendingGiftId, setResendingGiftId] = useState<string | null>(null);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id");
    if (checkout === "success" && sessionId) {
      toast.success("Subscription activated! Syncing your plan...");
      fetch("/api/stripe/confirm-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
        .then((r) => r.json())
        .then((res) => {
          if (res.success) {
            const { limit, period } = getBookLimitForTier(res.tier);
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    subscriptionTier: res.tier,
                    bookLimit: limit,
                    bookLimitPeriod: period,
                  }
                : prev
            );
            window.history.replaceState({}, "", "/settings");
          }
        })
        .catch(() => {});
    } else if (checkout === "success") {
      toast.success("Subscription activated! Thank you for upgrading.");
    }

    if (searchParams.get("gift") === "purchased") {
      toast.success("Gift purchased! Your gift code is in the Gifts section below.");
      window.history.replaceState({}, "", "/settings");
    }
  }, [searchParams]);

  const handleSyncSubscription = async () => {
    setSyncLoading(true);
    try {
      const res = await fetch("/api/stripe/sync", { method: "POST" });
      const json = await res.json();
      if (res.ok && json.success) {
        const settingsRes = await fetch("/api/user/settings");
        if (settingsRes.ok) {
          const fresh = await settingsRes.json();
          setData(fresh);
          setDisplayName(fresh.profile?.displayName ?? "");
          setPhone(fresh.profile?.phone ?? "");
        }
        toast.success("Plan synced! Your monthly limit has been updated.");
      } else {
        toast.error(json.error || "No subscription found to sync");
      }
    } catch {
      toast.error("Could not sync subscription");
    } finally {
      setSyncLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      if (json.url) window.location.href = json.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open billing");
    } finally {
      setPortalLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((res) => {
        setData(res);
        setDisplayName(res.profile?.displayName ?? "");
        setPhone(res.profile?.phone ?? "");
      })
      .catch(() => toast.error("Could not load settings"))
      .finally(() => setLoading(false));

    fetch("/api/gifts/my")
      .then((r) => (r.ok ? r.json() : { gifts: [] }))
      .then((res) => setMyGifts((res.gifts as GiftMembership[]) ?? []))
      .catch(() => {});
  }, []);

  const refreshMyGifts = async () => {
    try {
      const r = await fetch("/api/gifts/my");
      if (!r.ok) return;
      const res = await r.json();
      setMyGifts((res.gifts as GiftMembership[]) ?? []);
    } catch {
      // Ignore
    }
  };

  const handleStartGiftCheckout = async () => {
    setGiftCheckoutLoading(true);
    try {
      const res = await fetch("/api/stripe/gift-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: giftTier,
          period: giftPeriod,
          recipientEmail: giftRecipientEmail.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gift checkout failed");
      if (json.url) window.location.href = json.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start gift checkout");
    } finally {
      setGiftCheckoutLoading(false);
    }
  };

  const handleRedeemGift = async () => {
    if (!giftCode.trim()) {
      toast.error("Enter a gift code");
      return;
    }
    setRedeemingGift(true);
    try {
      const res = await fetch("/api/gifts/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: giftCode.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not redeem gift");
      toast.success(json.message || "Gift redeemed!");
      setGiftCode("");

      const settingsRes = await fetch("/api/user/settings");
      if (settingsRes.ok) {
        const fresh = await settingsRes.json();
        setData(fresh);
        setDisplayName(fresh.profile?.displayName ?? "");
        setPhone(fresh.profile?.phone ?? "");
      }
      await refreshMyGifts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not redeem gift");
    } finally {
      setRedeemingGift(false);
    }
  };

  const handleResendGiftEmail = async (giftId: string) => {
    setResendingGiftId(giftId);
    try {
      const res = await fetch("/api/gifts/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ giftId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not resend gift email");
      toast.success(json.message || "Gift email resent");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not resend gift email"
      );
    } finally {
      setResendingGiftId(null);
    }
  };


  const handleRevokeConsent = async () => {
    if (!confirm("This will revoke your consent. You will need to consent again before creating new books. Continue?")) return;
    setRevokeLoading(true);
    try {
      const res = await fetch("/api/user/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });
      const json = await res.json();
      if (res.ok && json.revoked) {
        toast.success("Consent revoked. You can re-consent when creating your next book.");
        setData((prev) => prev && prev.profile
          ? { ...prev, profile: { ...prev.profile, parentConsentAt: null } }
          : prev);
      } else {
        toast.error(json.error || "Could not revoke");
      }
    } catch {
      toast.error("Could not revoke consent");
    } finally {
      setRevokeLoading(false);
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          phone: phone.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const json = await res.json();
      setData((prev) =>
        prev
          ? {
              ...prev,
              profile: { ...prev.profile, ...json.profile },
            }
          : prev
      );
      toast.success("Contact info saved");
    } catch {
      toast.error("Could not save contact info");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)] dark:from-[var(--pastel-pink)] dark:via-background dark:to-[var(--pastel-mint)]">
        <AppHeader
          pageActions={
            <Link href="/">
              <Button variant="ghost" size="sm" className="size-9 px-2 sm:size-auto sm:px-3" aria-label="Home">
                <ArrowLeft className="size-4 sm:mr-1" />
                <span className="hidden sm:inline">Home</span>
              </Button>
            </Link>
          }
        />
        <main className="mx-auto max-w-2xl px-4 py-12">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Sparkles className="size-5 animate-pulse" />
            Loading settings…
          </div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)]">
        <AppHeader
          pageActions={
            <Link href="/">
              <Button variant="ghost" size="sm" className="size-9 px-2 sm:size-auto sm:px-3" aria-label="Home">
                <ArrowLeft className="size-4 sm:mr-1" />
                <span className="hidden sm:inline">Home</span>
              </Button>
            </Link>
          }
        />
        <main className="mx-auto max-w-2xl px-4 py-12 text-center">
          <p className="text-muted-foreground">Could not load settings.</p>
          <Link href="/">
            <Button variant="outline" className="mt-4">
              Back to home
            </Button>
          </Link>
        </main>
      </div>
    );
  }

  const { profile, bookCount, bookLimit, subscriptionTier } = data;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)] dark:from-[var(--pastel-pink)] dark:via-background dark:to-[var(--pastel-mint)]">
      <AppHeader
        pageActions={
          <Link href="/">
            <Button variant="ghost" size="sm" className="size-9 px-2 sm:size-auto sm:px-3" aria-label="Home">
              <ArrowLeft className="size-4 sm:mr-1" />
              <span className="hidden sm:inline">Home</span>
            </Button>
          </Link>
        }
      />

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          <h1 className="text-3xl font-bold text-foreground">Account settings</h1>

          {/* Profile info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="size-5" />
                Profile
              </CardTitle>
              <CardDescription>Your account information from Google</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4">
                {profile.image ? (
                  <img
                    src={profile.image}
                    alt=""
                    className="size-16 rounded-full border-2 border-border object-cover"
                  />
                ) : (
                  <div className="flex size-16 items-center justify-center rounded-full border-2 border-border bg-muted">
                    <User className="size-8 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-semibold">
                    {profile.name || profile.displayName || "No name"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {profile.email || "No email"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Theme:{" "}
                    <span className="capitalize">
                      {data.theme ?? profile.theme ?? "light"}
                    </span>{" "}
                    (toggle in header)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="size-5" />
                Contact information
              </CardTitle>
              <CardDescription>
                Optional. Add a display name or phone number if you&apos;d like.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveContact} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display name</Label>
                  <Input
                    id="displayName"
                    placeholder="e.g. Sarah"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="e.g. +1 555 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save contact info"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Subscription & book limit */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="size-5" />
                Subscription & usage
              </CardTitle>
              <CardDescription>
                Your current plan and book creation limit
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border-2 border-border bg-muted/50 px-4 py-3">
                <span className="font-medium">Plan</span>
                <span className="rounded-full bg-primary/20 px-3 py-1 text-sm font-medium capitalize text-primary">
                  {subscriptionTier}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border-2 border-border bg-muted/50 px-4 py-3">
                <span className="font-medium">Books created</span>
                <span className="text-muted-foreground">
                  {bookCount} / {bookLimit} {data.bookLimitPeriod === "monthly" ? "this month" : "total"}
                </span>
              </div>
              {bookCount >= bookLimit && (
                <p className="text-sm text-muted-foreground">
                  You&apos;ve reached your book limit. Upgrade your plan for more
                  stories!
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                {subscriptionTier === "free" ? (
                  <>
                    <Link href="/pricing">
                      <Button size="sm">
                        <Sparkles className="mr-1 size-4" />
                        Upgrade plan
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={syncLoading}
                      onClick={handleSyncSubscription}
                      title="If you just subscribed, click to sync your plan"
                      aria-label="Sync subscription plan"
                    >
                      {syncLoading ? (
                        <Loader2 className="mr-1 size-4 animate-spin" />
                      ) : null}
                      Just subscribed? Sync plan
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={portalLoading}
                    onClick={handleManageSubscription}
                  >
                    {portalLoading ? (
                      <Loader2 className="mr-1 size-4 animate-spin" />
                    ) : (
                      <ExternalLink className="mr-1 size-4" />
                    )}
                    Manage subscription
                  </Button>
                )}
                {subscriptionTier !== "free" && (
                  <Link href="/pricing">
                    <Button size="sm" variant="ghost">
                      Change plan
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Gifts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-5" />
                Gifts
              </CardTitle>
              <CardDescription>
                Gift a membership to someone else, or redeem a gift code you received.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3 rounded-xl border-2 border-border bg-muted/40 p-4">
                <p className="font-medium">Buy a gift membership</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="giftTier">Plan</Label>
                    <select
                      id="giftTier"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={giftTier}
                      onChange={(e) =>
                        setGiftTier(e.target.value as "spark" | "magic" | "legend")
                      }
                    >
                      <option value="spark">Spark</option>
                      <option value="magic">Magic</option>
                      <option value="legend">Legend</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="giftPeriod">Duration</Label>
                    <select
                      id="giftPeriod"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={giftPeriod}
                      onChange={(e) =>
                        setGiftPeriod(e.target.value as "monthly" | "yearly")
                      }
                    >
                      <option value="monthly">1 month gift</option>
                      <option value="yearly">1 year gift</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="giftRecipientEmail">Recipient email (optional)</Label>
                  <Input
                    id="giftRecipientEmail"
                    type="email"
                    placeholder="parent@example.com"
                    value={giftRecipientEmail}
                    onChange={(e) => setGiftRecipientEmail(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  disabled={giftCheckoutLoading}
                  onClick={handleStartGiftCheckout}
                >
                  {giftCheckoutLoading ? (
                    <Loader2 className="mr-1 size-4 animate-spin" />
                  ) : null}
                  Buy gift
                </Button>
              </div>

              <div className="space-y-3 rounded-xl border-2 border-border bg-muted/40 p-4">
                <p className="font-medium">Redeem a gift code</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder="KT-XXXXXXXXXXXX"
                    value={giftCode}
                    onChange={(e) => setGiftCode(e.target.value.toUpperCase())}
                  />
                  <Button
                    size="sm"
                    disabled={redeemingGift}
                    onClick={handleRedeemGift}
                  >
                    {redeemingGift ? (
                      <Loader2 className="mr-1 size-4 animate-spin" />
                    ) : null}
                    Redeem
                  </Button>
                </div>
              </div>

              {myGifts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">My purchased gift codes</p>
                  <div className="space-y-2">
                    {myGifts.slice(0, 6).map((gift) => (
                      <div
                        key={gift.id}
                        className="flex flex-col gap-1 rounded-lg border border-border bg-background px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-mono font-medium">{gift.code}</p>
                          <p className="text-xs text-muted-foreground">
                            {gift.tier} • {gift.durationMonths === 12 ? "1 year" : "1 month"} •{" "}
                            {gift.status}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(gift.code).catch(() => {});
                              toast.success("Gift code copied");
                            }}
                          >
                            Copy code
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={resendingGiftId === gift.id}
                            onClick={() => handleResendGiftEmail(gift.id)}
                          >
                            {resendingGiftId === gift.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              "Resend email"
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* COPPA: Manage child data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="size-5" />
                Manage child data
              </CardTitle>
              <CardDescription>
                Your rights under COPPA: access, delete, or revoke consent
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.parentConsentAt ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Consent given on {new Date(profile.parentConsentAt).toLocaleDateString()}.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link href="/settings/books">
                      <Button size="sm" variant="default">
                        <BookOpen className="mr-1 size-4" />
                        Manage books
                      </Button>
                    </Link>
                    <Link href="/settings/profiles">
                      <Button size="sm" variant="outline">
                        <User className="mr-1 size-4" />
                        Child profiles
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={revokeLoading}
                      onClick={handleRevokeConsent}
                    >
                      {revokeLoading ? (
                        <Loader2 className="mr-1 size-4 animate-spin" />
                      ) : null}
                      Revoke consent
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  You haven&apos;t given parental consent yet. You&apos;ll be prompted when you create your first book.
                </p>
              )}
              <Link href="/privacy" className="inline-block text-sm text-primary underline hover:no-underline">
                Privacy Policy
              </Link>
            </CardContent>
          </Card>

          {/* Feedback */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="size-5" />
                Feedback
              </CardTitle>
              <CardDescription>
                Help us improve KiddoTales. Share your thoughts, report bugs, or suggest features.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FeedbackTrigger variant="button" />
              <div className="mt-4">
                <Link href="/messages">
                  <Button variant="outline" size="sm">
                    Open Message Center
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}

function SettingsLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)] dark:from-[var(--pastel-pink)] dark:via-background dark:to-[var(--pastel-mint)]">
      <main className="mx-auto flex max-w-2xl items-center justify-center px-4 py-24">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Loading settings…
        </div>
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsContent />
    </Suspense>
  );
}
