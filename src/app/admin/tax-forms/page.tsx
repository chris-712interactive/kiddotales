"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Shield, Download, Check, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppHeader } from "@/components/app-header";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";

type TaxFormRow = {
  id: string;
  affiliateId: string;
  affiliateCode?: string;
  affiliateName?: string | null;
  affiliateEmail?: string | null;
  status: "submitted" | "verified" | "rejected";
  uploadedAt: string;
  originalFilename: string | null;
  rejectedReason: string | null;
  verifiedAt: string | null;
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function AdminTaxFormsPage() {
  const router = useRouter();
  const [forms, setForms] = useState<TaxFormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("submitted");
  const [month, setMonth] = useState<string>(() => currentMonth());
  const [updating, setUpdating] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch(`/api/admin/affiliate-tax-forms?status=${encodeURIComponent(statusFilter)}&month=${encodeURIComponent(month)}&limit=200`)
      .then((res) => {
        if (res.status === 401) router.replace("/sign-in?callbackUrl=/admin/tax-forms");
        if (res.status === 403) setError("Access denied.");
        return res.ok ? res.json() : null;
      })
      .then((data) => setForms((data?.forms ?? []) as TaxFormRow[]))
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, month]);

  const submittedCount = useMemo(() => forms.filter((f) => f.status === "submitted").length, [forms]);

  const download = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/affiliate-tax-forms/${id}/download`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Download failed");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const match = /filename=\"([^\"]+)\"/i.exec(cd);
      const filename = match?.[1] ?? "w9.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  };

  const setStatus = async (id: string, status: "verified" | "rejected") => {
    setUpdating(id);
    try {
      const rejectedReason = status === "rejected" ? prompt("Reason for rejection? (optional)") ?? "" : "";
      const res = await fetch(`/api/admin/affiliate-tax-forms/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, rejectedReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to update");
        return;
      }
      toast.success(status === "verified" ? "Marked verified" : "Marked rejected");
      load();
    } catch {
      toast.error("Failed to update");
    } finally {
      setUpdating(null);
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
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="size-9 px-2 sm:size-auto sm:px-3" aria-label="Back to admin">
              <ArrowLeft className="size-4 sm:mr-1" />
              <span className="hidden sm:inline">Admin</span>
            </Button>
          </Link>
        }
      />

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-4 md:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
          <section>
            <h1 className="text-2xl font-bold">W-9 Tax Forms</h1>
            <p className="text-muted-foreground">Review, download (proxy), and verify/reject affiliate W-9s.</p>
          </section>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="size-5" />
                    Forms
                  </CardTitle>
                  <CardDescription>
                    Showing {forms.length} form(s){statusFilter === "submitted" ? ` · ${submittedCount} submitted` : ""}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Month</span>
                    <input
                      type="month"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
                    <option value="submitted">Submitted</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              ) : forms.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No forms found for this filter.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-2 pr-4">Uploaded</th>
                        <th className="pb-2 pr-4">Affiliate</th>
                        <th className="pb-2 pr-4">Email</th>
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2 pr-4">Filename</th>
                        <th className="pb-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forms.map((f) => (
                        <tr key={f.id} className="border-b border-border/50">
                          <td className="py-2 pr-4">{new Date(f.uploadedAt).toLocaleDateString()}</td>
                          <td className="py-2 pr-4 font-mono">{f.affiliateCode ?? f.affiliateId}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{f.affiliateEmail ?? "—"}</td>
                          <td className="py-2 pr-4">
                            <span className="capitalize">{f.status}</span>
                            {f.status === "rejected" && f.rejectedReason ? (
                              <span className="ml-2 text-xs text-muted-foreground">({f.rejectedReason})</span>
                            ) : null}
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">{f.originalFilename ?? "w9.pdf"}</td>
                          <td className="py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Button variant="outline" size="sm" onClick={() => download(f.id)}>
                                <Download className="mr-1 size-4" />
                                Download
                              </Button>
                              {f.status === "submitted" && (
                                <>
                                  <Button size="sm" onClick={() => setStatus(f.id, "verified")} disabled={!!updating}>
                                    {updating === f.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="mr-1 size-4" />}
                                    Verify
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => setStatus(f.id, "rejected")}
                                    disabled={!!updating}
                                  >
                                    <X className="size-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
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

