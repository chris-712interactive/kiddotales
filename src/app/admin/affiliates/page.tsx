"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Shield,
  Plus,
  DollarSign,
  Copy,
  Download,
  UserPlus,
  Check,
  X,
  Trash2,
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
import { Select } from "@/components/ui/select";
import { AppHeader } from "@/components/app-header";
import { toast } from "sonner";
import type { Affiliate, AffiliateCommission, AffiliateRequest } from "@/lib/affiliates";

const COMMISSION_TYPE_LABELS: Record<string, string> = {
  first_only: "First payment only",
  recurring: "Recurring (every renewal)",
  both: "Both (first + lower % on renewals)",
};

export default function AdminAffiliatesPage() {
  const router = useRouter();
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [commissions, setCommissions] = useState<(AffiliateCommission & { affiliateCode?: string })[]>([]);
  const [requests, setRequests] = useState<AffiliateRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [approveForm, setApproveForm] = useState<{
    requestId: string;
    code: string;
    commissionRate: number;
    commissionType: "first_only" | "recurring" | "both";
    recurringRate: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    email: "",
    paypalId: "",
    commissionRate: 0.1,
    commissionType: "first_only" as "first_only" | "recurring" | "both",
    recurringRate: 0.05,
  });
  const [statusFilter, setStatusFilter] = useState<string>("");

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/affiliates").then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/admin/commissions?limit=200${statusFilter ? `&status=${statusFilter}` : ""}`).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch("/api/admin/affiliate-requests?status=pending").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([affData, commData, reqData]) => {
        if (affData?.affiliates) setAffiliates(affData.affiliates);
        if (commData?.commissions) setCommissions(commData.commissions);
        if (reqData?.requests) setRequests(reqData.requests);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/affiliates"),
      fetch("/api/admin/affiliate-requests?status=pending"),
    ])
      .then(([affRes, reqRes]) => {
        if (affRes.status === 401) router.replace("/sign-in?callbackUrl=/admin/affiliates");
        if (affRes.status === 403) setError("Access denied.");
        return Promise.all([
          affRes.ok ? affRes.json() : null,
          reqRes.ok ? reqRes.json() : null,
        ]);
      })
      .then(([affData, reqData]) => {
        if (affData?.affiliates) setAffiliates(affData.affiliates);
        if (reqData?.requests) setRequests(reqData.requests);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    fetch(`/api/admin/commissions?limit=200${statusFilter ? `&status=${statusFilter}` : ""}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCommissions(d.commissions ?? []))
      .catch(() => {});
  }, [statusFilter]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) {
      toast.error("Code is required");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim() || null,
          email: form.email.trim() || null,
          paypalId: form.paypalId.trim() || null,
          commissionRate: form.commissionRate,
          commissionType: form.commissionType,
          recurringRate: form.commissionType === "both" ? form.recurringRate : null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAffiliates((prev) => [data.affiliate, ...prev]);
        setForm({ code: "", name: "", email: "", paypalId: "", commissionRate: 0.1, commissionType: "first_only", recurringRate: 0.05 });
        toast.success("Affiliate added");
      } else {
        toast.error(data.error ?? "Failed to add");
      }
    } catch {
      toast.error("Failed to add affiliate");
    } finally {
      setAdding(false);
    }
  };

  const handleApprove = async (req: AffiliateRequest) => {
    const code = (approveForm?.code ?? "").trim().toUpperCase() || `${req.firstName}${req.lastName.charAt(0)}${Math.floor(1000 + Math.random() * 9000)}`;
    if (!code) {
      toast.error("Enter an affiliate code");
      return;
    }
    setApproving(req.id);
    try {
      const res = await fetch(`/api/admin/affiliate-requests/${req.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          commissionRate: approveForm?.commissionRate ?? 0.1,
          commissionType: approveForm?.commissionType ?? "first_only",
          recurringRate: approveForm?.commissionType === "both" ? (approveForm?.recurringRate ?? 0.05) : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== req.id));
        setAffiliates((prev) => (data.affiliate ? [data.affiliate, ...prev] : prev));
        setApproveForm(null);
        toast.success("Affiliate approved");
      } else {
        toast.error(data.error ?? "Failed to approve");
      }
    } catch {
      toast.error("Failed to approve");
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (req: AffiliateRequest) => {
    setApproving(req.id);
    try {
      const res = await fetch(`/api/admin/affiliate-requests/${req.id}/reject`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== req.id));
        setApproveForm(null);
        toast.success("Request rejected");
      } else {
        toast.error(data.error ?? "Failed to reject");
      }
    } catch {
      toast.error("Failed to reject");
    } finally {
      setApproving(null);
    }
  };

  const suggestedCode = (req: AffiliateRequest) =>
    `${req.firstName}${req.lastName.charAt(0)}${Math.floor(1000 + Math.random() * 9000)}`.toUpperCase();

  const handleRemoveAffiliate = async (affiliate: Affiliate) => {
    if (!confirm(`Remove affiliate ${affiliate.code}? They will no longer earn new commissions. Commission history is retained for tax purposes (7 years).`)) return;
    setRemoving(affiliate.id);
    try {
      const res = await fetch(`/api/admin/affiliates/${affiliate.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setAffiliates((prev) => prev.filter((a) => a.id !== affiliate.id));
        toast.success("Affiliate removed (commission history retained)");
      } else {
        toast.error(data.error ?? "Failed to remove");
      }
    } catch {
      toast.error("Failed to remove affiliate");
    } finally {
      setRemoving(null);
    }
  };

  const copyRefLink = (code: string) => {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/?ref=${code}`;
    navigator.clipboard.writeText(url);
    toast.success("Referral link copied");
  };

  const exportCsv = () => {
    const headers = ["Date", "Affiliate", "Type", "Amount", "Transaction", "Status"];
    const rows = commissions.map((c) => [
      new Date(c.createdAt).toISOString(),
      c.affiliateCode ?? c.affiliateId,
      c.type,
      c.amount.toFixed(2),
      c.transactionAmount.toFixed(2),
      c.status,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `affiliate-commissions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("CSV downloaded");
  };

  const pendingTotal = commissions.filter((c) => c.status === "pending").reduce((s, c) => s + c.amount, 0);

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
            <Link href="/admin/payouts">
              <Button variant="ghost" size="sm" className="size-9 px-2 sm:size-auto sm:px-3" aria-label="Payouts">
                <DollarSign className="size-4 sm:mr-1" />
                <span className="hidden sm:inline">Payouts</span>
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

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          <section>
            <h1 className="text-2xl font-bold">Affiliates</h1>
            <p className="text-muted-foreground">
              Manage affiliates and view commissions. Referral links: <code className="rounded bg-muted px-1">/?ref=CODE</code>
            </p>
          </section>

          {requests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="size-5" />
                  Pending affiliate requests ({requests.length})
                </CardTitle>
                <CardDescription>Applications from users with KiddoTales accounts. Approve to create affiliate and assign code.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {requests.map((req) => (
                    <div
                      key={req.id}
                      className="rounded-lg border border-border bg-muted/20 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="font-medium">
                            {req.firstName} {req.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">{req.email}</p>
                          {req.paypalId && (
                            <p className="text-sm text-muted-foreground">PayPal: <span className="font-mono">{req.paypalId}</span></p>
                          )}
                          <p className="mt-1 text-sm">
                            Audience: {req.audienceSize.toLocaleString()} · Applied{" "}
                            {new Date(req.createdAt).toLocaleDateString()}
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{req.pitch}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {approveForm?.requestId === req.id ? (
                            <div className="flex min-w-[200px] flex-col gap-3">
                              <Input
                                placeholder="Code (e.g. SARAH2024)"
                                value={approveForm.code}
                                onChange={(e) =>
                                  setApproveForm((f) => (f ? { ...f, code: e.target.value } : null))}
                                className="w-40"
                              />
                              <div>
                                <Label className="text-xs">Commission type</Label>
                                <Select
                                  value={approveForm.commissionType}
                                  onChange={(e) =>
                                    setApproveForm((f) =>
                                      f ? { ...f, commissionType: e.target.value as "first_only" | "recurring" | "both" } : null
                                    )}
                                  className="mt-0.5 w-full"
                                >
                                  {Object.entries(COMMISSION_TYPE_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                  ))}
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Commission rate (first payment)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="1"
                                  value={approveForm.commissionRate}
                                  onChange={(e) =>
                                    setApproveForm((f) =>
                                      f ? { ...f, commissionRate: parseFloat(e.target.value) || 0 } : null
                                    )}
                                  className="mt-0.5 w-24"
                                />
                                <span className="ml-1 text-xs text-muted-foreground">e.g. 0.1 = 10%</span>
                              </div>
                              {approveForm.commissionType === "both" && (
                                <div>
                                  <Label className="text-xs">Recurring rate</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="1"
                                    value={approveForm.recurringRate}
                                    onChange={(e) =>
                                      setApproveForm((f) =>
                                        f ? { ...f, recurringRate: parseFloat(e.target.value) || 0 } : null
                                      )}
                                    className="mt-0.5 w-24"
                                  />
                                </div>
                              )}
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  disabled={!!approving}
                                  onClick={() => handleApprove(req)}
                                >
                                  {approving === req.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setApproveForm(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                disabled={!!approving}
                                onClick={() =>
                                  setApproveForm({
                                    requestId: req.id,
                                    code: suggestedCode(req),
                                    commissionRate: 0.1,
                                    commissionType: "first_only",
                                    recurringRate: 0.05,
                                  })
                                }
                              >
                                {approving === req.id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <>
                                    <Check className="mr-1 size-4" />
                                    Approve
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={!!approving}
                                onClick={() => handleReject(req)}
                              >
                                <X className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Add affiliate manually</CardTitle>
              <CardDescription>Code is used in referral URLs (e.g. ?ref=CODE). Use for affiliates added outside the application flow.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdd} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    value={form.code}
                    onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                    placeholder="SARAH2024"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Optional"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="Optional"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="paypalId">PayPal ID (for payouts)</Label>
                  <Input
                    id="paypalId"
                    value={form.paypalId}
                    onChange={(e) => setForm((p) => ({ ...p, paypalId: e.target.value }))}
                    placeholder="PayPal email or ID"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="rate">Commission rate</Label>
                  <Input
                    id="rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={form.commissionRate}
                    onChange={(e) => setForm((p) => ({ ...p, commissionRate: parseFloat(e.target.value) || 0 }))}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground">e.g. 0.1 = 10%</p>
                </div>
                <div>
                  <Label htmlFor="type">Commission type</Label>
                  <Select
                    id="type"
                    value={form.commissionType}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        commissionType: e.target.value as "first_only" | "recurring" | "both",
                      }))
                    }
                    className="mt-1"
                  >
                    {Object.entries(COMMISSION_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </div>
                {form.commissionType === "both" && (
                  <div>
                    <Label htmlFor="recurring">Recurring rate</Label>
                    <Input
                      id="recurring"
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={form.recurringRate}
                      onChange={(e) => setForm((p) => ({ ...p, recurringRate: parseFloat(e.target.value) || 0 }))}
                      className="mt-1"
                    />
                  </div>
                )}
                <div className="flex items-end">
                  <Button type="submit" disabled={adding}>
                    {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
                    Add
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Affiliates</CardTitle>
              <CardDescription>{affiliates.length} total</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              ) : affiliates.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No affiliates yet.</p>
              ) : (
                <div className="space-y-3">
                  {affiliates.map((a) => (
                    <div
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3"
                    >
                      <div>
                        <span className="font-mono font-semibold">{a.code}</span>
                        {a.name && <span className="ml-2 text-muted-foreground">{a.name}</span>}
                        <span className="ml-2 text-sm text-muted-foreground">
                          {(a.commissionRate * 100).toFixed(0)}% · {COMMISSION_TYPE_LABELS[a.commissionType] ?? a.commissionType}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => copyRefLink(a.code)}>
                          <Copy className="mr-1 size-4" />
                          Copy link
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={!!removing}
                          onClick={() => handleRemoveAffiliate(a)}
                          aria-label={`Remove affiliate ${a.code}`}
                        >
                          {removing === a.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="size-5" />
                    Commissions
                  </CardTitle>
                  <CardDescription>
                    Pending total: ${pendingTotal.toFixed(2)} · Export for manual payouts
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-36"
                  >
                    <option value="">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="cancelled">Cancelled</option>
                  </Select>
                  <Button variant="outline" size="sm" onClick={exportCsv}>
                    <Download className="mr-1 size-4" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {commissions.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No commissions yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-2 pr-4">Date</th>
                        <th className="pb-2 pr-4">Affiliate</th>
                        <th className="pb-2 pr-4">Type</th>
                        <th className="pb-2 pr-4">Amount</th>
                        <th className="pb-2 pr-4">Transaction</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commissions.map((c) => (
                        <tr key={c.id} className="border-b border-border/50">
                          <td className="py-2 pr-4">{new Date(c.createdAt).toLocaleDateString()}</td>
                          <td className="py-2 pr-4 font-mono">{c.affiliateCode ?? c.affiliateId}</td>
                          <td className="py-2 pr-4">{c.type}</td>
                          <td className="py-2 pr-4">${c.amount.toFixed(2)}</td>
                          <td className="py-2 pr-4">${c.transactionAmount.toFixed(2)}</td>
                          <td className="py-2">{c.status}</td>
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
