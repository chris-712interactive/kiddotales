"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Copy, DollarSign, Link2, Users, Sparkles, Zap, Crown, FileUp, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AppHeader } from "@/components/app-header";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

type CommissionRow = {
  id: string;
  type: string;
  amount: number;
  transactionAmount: number;
  status: string;
  createdAt: string;
};

type AffiliateDashboard = {
  affiliate: {
    id: string;
    code: string;
    name: string | null;
    commissionRate: number;
    commissionType: string;
  } | null;
  taxForm?: {
    year: number;
    hasW9OnFile: boolean;
    status: string | null;
    uploadedAt: string | null;
    source: "electronic" | "uploaded" | null;
    signedAt: string | null;
  };
  referredByTier?: Record<string, number>;
  commissions: CommissionRow[];
};

const TIER_LABELS: Record<string, { name: string; icon: React.ReactNode }> = {
  free: { name: "Free", icon: <Sparkles className="size-5" /> },
  spark: { name: "Spark", icon: <Zap className="size-5" /> },
  magic: { name: "Magic", icon: <Sparkles className="size-5" /> },
  legend: { name: "Legend", icon: <Crown className="size-5" /> },
};

export default function AffiliateDashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [data, setData] = useState<AffiliateDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [w9Uploading, setW9Uploading] = useState(false);
  const [w9File, setW9File] = useState<File | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/sign-in?callbackUrl=/affiliate");
      return;
    }
    if (status !== "authenticated") return;

    fetch("/api/user/affiliate")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData({ affiliate: null, commissions: [] }))
      .finally(() => setLoading(false));
  }, [status, router]);

  const copyLink = (code: string) => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/?ref=${code}` : "";
    navigator.clipboard.writeText(url);
    toast.success("Referral link copied");
  };

  const uploadW9 = async () => {
    if (!w9File) {
      toast.error("Choose a PDF first");
      return;
    }
    if (w9File.type !== "application/pdf") {
      toast.error("W-9 must be a PDF");
      return;
    }
    setW9Uploading(true);
    try {
      const uploadRes = await fetch("/api/affiliate/tax-forms/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: w9File.name,
          mimeType: w9File.type,
          sizeBytes: w9File.size,
        }),
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        toast.error(uploadData.error ?? "Failed to start upload");
        return;
      }

      const putRes = await fetch(uploadData.signedUrl, {
        method: "PUT",
        body: w9File,
        headers: { "Content-Type": w9File.type },
      });
      if (!putRes.ok) {
        const errText = await putRes.text();
        toast.error(errText || "Upload failed");
        return;
      }

      const completeRes = await fetch("/api/affiliate/tax-forms/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: uploadData.path,
          originalFilename: uploadData.originalFilename,
          mimeType: w9File.type,
          sizeBytes: w9File.size,
          year: new Date().getFullYear(),
        }),
      });
      const completeData = await completeRes.json();
      if (!completeRes.ok) {
        toast.error(completeData.error ?? "Upload completed but metadata save failed");
        return;
      }

      toast.success("W-9 uploaded");
      setW9File(null);
    } catch {
      toast.error("Failed to upload W-9");
    } finally {
      setW9Uploading(false);
    }
  };

  if (status === "loading" || status === "unauthenticated" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.affiliate) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)]">
        <AppHeader
          pageActions={
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="size-4 sm:mr-1" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </Link>
          }
        />
        <main className="mx-auto max-w-2xl px-4 pb-16 pt-8 md:px-8">
          <Card>
            <CardHeader>
              <CardTitle>Affiliate dashboard</CardTitle>
              <CardDescription>
                You're not in the affiliate program yet. Apply to get your referral link and earn commissions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/become-affiliate">
                <Button>Apply to become an affiliate</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const { affiliate, commissions, referredByTier = {} } = data;
  const taxForm = data.taxForm;
  const refUrl = typeof window !== "undefined" ? `${window.location.origin}/?ref=${affiliate.code}` : "";
  const pendingTotal = commissions.filter((c) => c.status === "pending").reduce((s, c) => s + c.amount, 0);
  const paidTotal = commissions.filter((c) => c.status === "paid").reduce((s, c) => s + c.amount, 0);
  const tierOrder = ["free", "spark", "magic", "legend"];

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

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-8 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          <section>
            <h1 className="text-2xl font-bold">Affiliate dashboard</h1>
            <p className="text-muted-foreground">Your referral link and commission history</p>
          </section>

          {taxForm && !taxForm.hasW9OnFile && (
            <Card className="border-2 border-amber-400/60 bg-amber-50/40">
              <CardHeader>
                <CardTitle>Action required: submit your W-9</CardTitle>
                <CardDescription>
                  To receive affiliate payouts, we need a W-9 on file for {taxForm.year}. You can fill it out online or upload a PDF.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Link href="/affiliate/w9">
                  <Button variant="default" size="sm">Fill out W-9 online</Button>
                </Link>
                <a href="#w9-card">
                  <Button variant="outline" size="sm">Upload a PDF</Button>
                </a>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="size-5" />
                Your referral link
              </CardTitle>
              <CardDescription>
                Share this link. When someone signs up and subscribes via your link, you earn a commission.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                <code className="flex-1 break-all rounded-lg bg-muted px-3 py-2 text-sm">
                  {refUrl}
                </code>
                <Button variant="outline" size="sm" onClick={() => copyLink(affiliate.code)}>
                  <Copy className="mr-1 size-4" />
                  Copy
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Your code: <span className="font-mono">{affiliate.code}</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5" />
                Referred subscriptions
              </CardTitle>
              <CardDescription>
                Users who signed up via your link, by current plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {tierOrder.map((tier) => {
                  const count = referredByTier[tier] ?? 0;
                  const label = TIER_LABELS[tier] ?? { name: tier, icon: null };
                  return (
                    <div
                      key={tier}
                      className="flex flex-col items-center rounded-lg border border-border bg-muted/30 p-4"
                    >
                      <span className="text-muted-foreground">{label.icon}</span>
                      <span className="mt-1 text-2xl font-bold">{count}</span>
                      <span className="text-xs text-muted-foreground">{label.name}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5" />
                Tax form (W-9)
              </CardTitle>
              <CardDescription>
                Fill it out online (recommended) or upload your own PDF. This is stored securely and only the KiddoTales owner/admin can access it.
              </CardDescription>
            </CardHeader>
            <CardContent id="w9-card">
              {taxForm?.hasW9OnFile && (
                <div className="mb-4 rounded-lg border border-border bg-muted/20 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">W-9 on file for {taxForm.year}</div>
                      <div className="text-xs text-muted-foreground">
                        Status: {taxForm.status ?? "submitted"}
                        {taxForm.source ? ` · Source: ${taxForm.source}` : ""}
                        {taxForm.uploadedAt ? ` · Submitted: ${new Date(taxForm.uploadedAt).toLocaleDateString()}` : ""}
                      </div>
                    </div>
                    <Link href="/affiliate/w9">
                      <Button variant="outline" size="sm">Submit a new W-9</Button>
                    </Link>
                  </div>
                </div>
              )}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Link href="/affiliate/w9">
                  <Button variant="outline" size="sm">
                    Fill out W-9 online
                  </Button>
                </Link>
                <span className="text-xs text-muted-foreground">or upload your PDF below</span>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="w-full">
                  <label className="text-sm font-medium">W-9 PDF</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="mt-2 block w-full text-sm"
                    onChange={(e) => setW9File(e.target.files?.[0] ?? null)}
                    disabled={w9Uploading}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">PDF only · Max 10MB</p>
                </div>
                <Button onClick={uploadW9} disabled={w9Uploading || !w9File} className="sm:w-auto">
                  {w9Uploading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="mr-2 size-4" />}
                  Upload W-9
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="size-5" />
                Commissions
              </CardTitle>
              <CardDescription>
                Pending: ${pendingTotal.toFixed(2)} · Paid: ${paidTotal.toFixed(2)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {commissions.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No commissions yet. Share your link to start earning.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-2 pr-4">Date</th>
                        <th className="pb-2 pr-4">Type</th>
                        <th className="pb-2 pr-4">Amount</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commissions.map((c) => (
                        <tr key={c.id} className="border-b border-border/50">
                          <td className="py-2 pr-4">{new Date(c.createdAt).toLocaleDateString()}</td>
                          <td className="py-2 pr-4 capitalize">{c.type.replace("_", " ")}</td>
                          <td className="py-2 pr-4">${c.amount.toFixed(2)}</td>
                          <td className="py-2 capitalize">{c.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
