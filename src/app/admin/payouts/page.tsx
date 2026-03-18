"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Shield,
  DollarSign,
  Banknote,
  Check,
  CheckSquare,
  Square,
} from "lucide-react";
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
import type { AffiliateCommission } from "@/lib/affiliates";

type LineItem = AffiliateCommission & { affiliateCode?: string; affiliatePaypalId?: string | null };

/** Previous calendar month as YYYY-MM */
function previousMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Month label for display */
function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function AdminPayoutsPage() {
  const router = useRouter();
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [month, setMonth] = useState<string>(() => previousMonth());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [payoutType, setPayoutType] = useState("PayPal");

  const fetchLineItems = useCallback((monthParam: string) => {
    setLoading(true);
    fetch(`/api/admin/payouts?month=${encodeURIComponent(monthParam)}`)
      .then((res) => {
        if (res.status === 401) router.replace("/sign-in?callbackUrl=/admin/payouts");
        if (res.status === 403) setError("Access denied.");
        return res.ok ? res.json() : null;
      })
      .then((data) => {
        if (data?.lineItems) {
          setLineItems(data.lineItems);
          setStartDate(data.startDate ?? "");
          setEndDate(data.endDate ?? "");
        } else {
          setLineItems([]);
          setStartDate("");
          setEndDate("");
        }
        setSelected(new Set());
      })
      .catch(() => {
        setError("Failed to load payouts");
        setLineItems([]);
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    fetchLineItems(month);
  }, [month, fetchLineItems]);

  const pending = lineItems.filter((c) => c.status === "pending");
  const paid = lineItems.filter((c) => c.status === "paid");
  const pendingTotal = pending.reduce((s, c) => s + c.amount, 0);
  const paidTotal = paid.reduce((s, c) => s + c.amount, 0);

  const pendingIds = new Set(pending.map((c) => c.id));
  const allPendingSelected = pending.length > 0 && pending.every((c) => selected.has(c.id));

  const toggleSelect = (id: string) => {
    if (!pendingIds.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllPending = () => {
    if (allPendingSelected) setSelected(new Set());
    else setSelected(new Set(pending.map((c) => c.id)));
  };

  const handleReconcile = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      toast.error("Select at least one pending line to reconcile");
      return;
    }
    const typeForAccounting = payoutType.trim();
    if (!typeForAccounting) {
      toast.error("Enter a payout type for accounting (e.g. Monthly - February 2025)");
      return;
    }
    setReconciling(true);
    try {
      const res = await fetch("/api/admin/payouts/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionIds: ids, payoutType: typeForAccounting }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Marked ${data.updated} commission(s) as paid`);
        setPayoutType("PayPal");
        fetchLineItems(month);
      } else {
        toast.error(data.error ?? "Failed to reconcile");
      }
    } catch {
      toast.error("Failed to reconcile");
    } finally {
      setReconciling(false);
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)] px-4">
        <Shield className="size-16 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-bold">Access denied</h1>
        <p className="mt-2 text-muted-foreground">{error}</p>
        <Link href="/admin" className="mt-6">
          <Button>Back to Admin</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)]">
      <AppHeader
        pageActions={
          <div className="flex items-center gap-2">
            <Link href="/admin/affiliates">
              <Button variant="ghost" size="sm" className="size-9 px-2 sm:size-auto sm:px-3" aria-label="Affiliates">
                <DollarSign className="size-4 sm:mr-1" />
                <span className="hidden sm:inline">Affiliates</span>
              </Button>
            </Link>
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="size-9 px-2 sm:size-auto sm:px-3" aria-label="Back to admin">
                <ArrowLeft className="size-4 sm:mr-1" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            </Link>
          </div>
        }
      />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          <section>
            <h1 className="text-2xl font-bold">Affiliate Payouts</h1>
            <p className="text-muted-foreground">
              Reconcile by line item. Filter by month (e.g. previous month), select lines or all pending, then mark as paid with a payout type for accounting.
            </p>
          </section>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="size-5" />
                    Payouts by period
                  </CardTitle>
                  <CardDescription>
                    Pay on the 5th for the previous month’s activity. Select month to see line items, then reconcile when sent.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="month" className="text-sm whitespace-nowrap">Month</Label>
                  <input
                    id="month"
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMonth(previousMonth())}
                  >
                    Previous month
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
                    <span>
                      <strong>{monthLabel(month)}</strong>
                      {startDate && endDate && (
                        <span className="text-muted-foreground"> ({startDate} – {endDate})</span>
                      )}
                    </span>
                    <span className="text-muted-foreground">
                      Pending: ${pendingTotal.toFixed(2)} ({pending.length}) · Paid: ${paidTotal.toFixed(2)} ({paid.length})
                    </span>
                  </div>

                  {lineItems.length === 0 ? (
                    <p className="py-8 text-center text-muted-foreground">No commissions in this period.</p>
                  ) : (
                    <>
                      <div className="mb-4 flex flex-wrap items-center gap-4">
                        {pending.length > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={selectAllPending}
                              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                            >
                              {allPendingSelected ? (
                                <CheckSquare className="size-4" />
                              ) : (
                                <Square className="size-4" />
                              )}
                              {allPendingSelected ? "Deselect all" : "Select all"} pending
                            </button>
                            <div className="flex flex-wrap items-center gap-2">
                              <Label htmlFor="payoutType" className="text-sm">Payout type (for accounting)</Label>
                              <Input
                                id="payoutType"
                                placeholder="e.g. PayPal - February 2025"
                                value={payoutType}
                                onChange={(e) => setPayoutType(e.target.value)}
                                className="max-w-xs"
                              />
                              <Button
                                onClick={handleReconcile}
                                disabled={reconciling || selected.size === 0}
                              >
                                {reconciling ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Check className="mr-1 size-4" />
                                )}
                                Reconcile selected ({selected.size})
                              </Button>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-border bg-muted/50">
                              <th className="w-10 p-2"></th>
                              <th className="p-2">Date</th>
                              <th className="p-2">Affiliate</th>
                              <th className="p-2">PayPal ID</th>
                              <th className="p-2">Type</th>
                              <th className="p-2">Amount</th>
                              <th className="p-2">Status</th>
                              <th className="p-2">Reconciled at</th>
                              <th className="p-2">Payout type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lineItems.map((c) => (
                              <tr
                                key={c.id}
                                className={`border-b border-border/50 ${c.status === "pending" ? "bg-background" : "bg-muted/20"}`}
                              >
                                <td className="p-2">
                                  {c.status === "pending" ? (
                                    <input
                                      type="checkbox"
                                      checked={selected.has(c.id)}
                                      onChange={() => toggleSelect(c.id)}
                                      className="rounded border-border"
                                    />
                                  ) : (
                                    <Check className="size-5 text-green-600 dark:text-green-400" aria-label="Reconciled" />
                                  )}
                                </td>
                                <td className="p-2">{new Date(c.createdAt).toLocaleDateString()}</td>
                                <td className="p-2 font-mono">{c.affiliateCode ?? c.affiliateId}</td>
                                <td className="p-2 text-muted-foreground font-mono text-xs">
                                  {(c as LineItem).affiliatePaypalId ?? "—"}
                                </td>
                                <td className="p-2">{c.type}</td>
                                <td className="p-2 font-mono">${c.amount.toFixed(2)}</td>
                                <td className="p-2">{c.status}</td>
                                <td className="p-2 text-muted-foreground">
                                  {c.paidAt ? new Date(c.paidAt).toLocaleString() : "—"}
                                </td>
                                <td className="p-2 text-muted-foreground">
                                  {c.payoutType ?? "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
