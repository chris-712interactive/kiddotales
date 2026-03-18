"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, CheckCircle, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/app-header";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

type Status = "loading" | "none" | "affiliate" | "pending" | "rejected";

export default function BecomeAffiliatePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [pageStatus, setPageStatus] = useState<Status>("loading");
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    audienceSize: "",
    pitch: "",
    paypalId: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/sign-in?callbackUrl=/become-affiliate");
      return;
    }
    if (status !== "authenticated") return;

    fetch("/api/affiliate-request")
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "affiliate") {
          setPageStatus("affiliate");
          setAffiliateCode(data.affiliate?.code ?? null);
        } else if (data.status === "request") {
          const reqStatus = data.request?.status ?? "pending";
          setPageStatus(reqStatus === "pending" ? "pending" : "rejected");
        } else {
          setPageStatus("none");
          const sessionEmail = session?.user?.email ?? "";
          if (sessionEmail) setForm((f) => ({ ...f, email: sessionEmail }));
        }
      })
      .catch(() => setPageStatus("none"))
      .finally(() => setPageStatus((s) => (s === "loading" ? "none" : s)));
  }, [status, router, session?.user?.email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pageStatus !== "none" || submitting) return;

    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const email = form.email.trim();
    const audienceSize = parseInt(form.audienceSize, 10);
    const pitch = form.pitch.trim();
    const paypalId = form.paypalId.trim();

    if (!firstName || !lastName) {
      toast.error("First and last name are required");
      return;
    }
    if (!email) {
      toast.error("Email is required");
      return;
    }
    if (pitch.length < 50) {
      toast.error("Please write at least 50 characters explaining why you'd be a good fit");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/affiliate-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          audienceSize: isNaN(audienceSize) ? 0 : Math.max(0, audienceSize),
          pitch,
          paypalId: paypalId || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPageStatus("pending");
        toast.success("Application submitted! We'll review it soon.");
      } else {
        toast.error(data.error ?? "Failed to submit");
      }
    } catch {
      toast.error("Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading" || status === "unauthenticated" || pageStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)]">
      <AppHeader
        pageActions={
          <Link href="/">
            <Button variant="ghost" size="sm" className="size-9 px-2 sm:size-auto sm:px-3">
              <ArrowLeft className="size-4 sm:mr-1" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          </Link>
        }
      />

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-8 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {pageStatus === "affiliate" && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle className="size-8 text-primary" />
                  <div>
                    <CardTitle>You're a KiddoTales partner</CardTitle>
                    <CardDescription>
                      Your referral code: <code className="rounded bg-muted px-1 font-mono">{affiliateCode}</code>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Share your link:{" "}
                  <code className="rounded bg-muted px-1">
                    {typeof window !== "undefined" ? window.location.origin : ""}/?ref={affiliateCode}
                  </code>
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/affiliate">
                    <Button>View dashboard & commissions</Button>
                  </Link>
                  <Link href="/">
                    <Button variant="outline">Back to home</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {pageStatus === "pending" && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="size-8 text-amber-500" />
                  <div>
                    <CardTitle>Application under review</CardTitle>
                    <CardDescription>We'll be in touch soon. Thanks for your interest!</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Link href="/">
                  <Button>Back to home</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {pageStatus === "rejected" && (
            <Card>
              <CardHeader>
                <CardTitle>Application status</CardTitle>
                <CardDescription>
                  Your previous application was not approved at this time. You can contact us if you have questions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/">
                  <Button>Back to home</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {pageStatus === "none" && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="size-8 text-primary" />
                  <div>
                    <CardTitle>Partner with KiddoTales</CardTitle>
                    <CardDescription>
                      Join our affiliate program and earn when you share KiddoTales with your audience. You must have a KiddoTales account to apply.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={form.firstName}
                        onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                        placeholder="Sarah"
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={form.lastName}
                        onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                        placeholder="Smith"
                        className="mt-1"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="email">Email (KiddoTales account)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="sarah@example.com"
                      className="mt-1"
                      required
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Must match the email you use to sign in
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="audienceSize">Current Audience Size</Label>
                    <Input
                      id="audienceSize"
                      type="number"
                      min={0}
                      value={form.audienceSize}
                      onChange={(e) => setForm((f) => ({ ...f, audienceSize: e.target.value }))}
                      placeholder="10000"
                      className="mt-1"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Approximate number of followers or subscribers</p>
                  </div>
                  <div>
                    <Label htmlFor="paypalId">PayPal ID (for payouts)</Label>
                    <Input
                      id="paypalId"
                      type="text"
                      value={form.paypalId}
                      onChange={(e) => setForm((f) => ({ ...f, paypalId: e.target.value }))}
                      placeholder="PayPal email or PayPal Me ID"
                      className="mt-1"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">We pay affiliates via PayPal. Enter the email or ID you use to receive payments.</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="pitch">Why you would be a good fit (min 50 characters)</Label>
                      <span
                        className={`text-xs tabular-nums ${
                          form.pitch.length >= 50 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                        }`}
                      >
                        {form.pitch.length} / 50
                      </span>
                    </div>
                    <textarea
                      id="pitch"
                      value={form.pitch}
                      onChange={(e) => setForm((f) => ({ ...f, pitch: e.target.value }))}
                      placeholder="Tell us about your audience, content, and why KiddoTales is a good fit..."
                      className="mt-1 min-h-[120px] w-full rounded-xl border-2 border-input bg-background px-4 py-3 text-base"
                      required
                      minLength={50}
                    />
                  </div>
                  <Button type="submit" disabled={submitting} className="w-full">
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : "Submit application"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </main>
    </div>
  );
}
