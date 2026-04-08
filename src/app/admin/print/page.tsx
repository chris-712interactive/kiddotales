"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Package, Plus, Shield, Trash2 } from "lucide-react";
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

type PrintConfig = {
  printsEnabled: boolean;
  defaultPodPackageId: string;
  contactEmail: string | null;
  defaultShippingOption: string;
  allowedShippingOptions: string[];
};

type PricingRule = {
  id: string;
  isActive: boolean;
  markupPercent: number;
  flatFeeCents: number;
  minRetailCents: number | null;
  maxRetailCents: number | null;
  roundToNineteen: boolean;
};

type PrintOrder = {
  id: string;
  userId: string;
  bookId: string;
  printBookStyleId: string | null;
  podPackageId: string;
  status: string;
  retailAmountCents: number;
  currency: string;
  wholesaleTotalInclTax: string | null;
  luluPrintJobId: string | null;
  luluJobStatus: string | null;
  stripeCheckoutSessionId: string | null;
  createdAt: string;
  errorMessage: string | null;
};

type AdminBookStyle = {
  id: string;
  podPackageId: string;
  name: string;
  description: string | null;
  trimWidthIn: number;
  trimHeightIn: number;
  coverBleedIn: number;
  coverSafeMarginIn: number;
  /** null = derive spine from Lulu wrap width */
  spineWidthIn: number | null;
  sortOrder: number;
  isActive: boolean;
};

export default function AdminPrintPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);
  const [config, setConfig] = useState<PrintConfig | null>(null);
  const [pricing, setPricing] = useState<PricingRule | null>(null);
  const [orders, setOrders] = useState<PrintOrder[]>([]);
  const [bookStyles, setBookStyles] = useState<AdminBookStyle[]>([]);
  const [savingStyleId, setSavingStyleId] = useState<string | null>(null);
  const [newStyle, setNewStyle] = useState({
    podPackageId: "0850X1100.FC.STD.PB.060UW444.MXX",
    name: "",
    description: "",
    trimWidthIn: 8.5,
    trimHeightIn: 11,
    coverBleedIn: 0.125,
    coverSafeMarginIn: 0.25,
    spineWidthIn: null as number | null,
    sortOrder: 0,
  });

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/print-config"),
      fetch("/api/admin/print-pricing"),
      fetch("/api/admin/print-orders"),
      fetch("/api/admin/print-styles"),
    ])
      .then(async ([c, p, o, st]) => {
        if (c.status === 401) router.replace("/sign-in?callbackUrl=/admin/print");
        if (c.status === 403 || p.status === 403) setError("Access denied.");
        const cj = c.ok ? await c.json() : null;
        const pj = p.ok ? await p.json() : null;
        const oj = o.ok ? await o.json() : null;
        const stj = st.ok ? await st.json() : null;
        if (cj) setConfig(cj);
        if (pj?.rules?.length) {
          const activeId = pj.activeId as string | null;
          const pick =
            pj.rules.find((r: PricingRule) => r.id === activeId) ?? pj.rules[0];
          setPricing(pick);
        }
        if (oj?.orders) setOrders(oj.orders);
        if (stj?.styles) {
          setBookStyles(
            (stj.styles as Record<string, unknown>[]).map((s) => ({
              ...(s as unknown as AdminBookStyle),
              coverBleedIn:
                typeof s.coverBleedIn === "number" ? s.coverBleedIn : 0.125,
              coverSafeMarginIn:
                typeof s.coverSafeMarginIn === "number" ? s.coverSafeMarginIn : 0.25,
              spineWidthIn:
                typeof s.spineWidthIn === "number" ? s.spineWidthIn : null,
            }))
          );
        }
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  const saveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      const res = await fetch("/api/admin/print-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printsEnabled: config.printsEnabled,
          defaultPodPackageId: config.defaultPodPackageId,
          contactEmail: config.contactEmail,
          defaultShippingOption: config.defaultShippingOption,
          allowedShippingOptions: config.allowedShippingOptions,
        }),
      });
      if (!res.ok) {
        toast.error("Could not save product config");
        return;
      }
      toast.success("Product config saved");
      load();
    } finally {
      setSavingConfig(false);
    }
  };

  const saveBookStyle = async (s: AdminBookStyle) => {
    setSavingStyleId(s.id);
    try {
      const res = await fetch(`/api/admin/print-styles/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          podPackageId: s.podPackageId,
          name: s.name,
          description: s.description,
          trimWidthIn: s.trimWidthIn,
          trimHeightIn: s.trimHeightIn,
          coverBleedIn: s.coverBleedIn,
          coverSafeMarginIn: s.coverSafeMarginIn,
          spineWidthIn: s.spineWidthIn,
          sortOrder: s.sortOrder,
          isActive: s.isActive,
        }),
      });
      if (!res.ok) {
        toast.error("Could not save book format");
        return;
      }
      toast.success("Book format saved");
      load();
    } finally {
      setSavingStyleId(null);
    }
  };

  const deleteBookStyle = async (id: string) => {
    if (!confirm("Delete this book format? Past orders keep a null reference.")) return;
    const res = await fetch(`/api/admin/print-styles/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    toast.success("Deleted");
    load();
  };

  const addBookStyle = async () => {
    const name = newStyle.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    const res = await fetch("/api/admin/print-styles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        podPackageId: newStyle.podPackageId.trim(),
        name,
        description: newStyle.description.trim() || null,
        trimWidthIn: newStyle.trimWidthIn,
        trimHeightIn: newStyle.trimHeightIn,
        coverBleedIn: newStyle.coverBleedIn,
        coverSafeMarginIn: newStyle.coverSafeMarginIn,
        spineWidthIn: newStyle.spineWidthIn,
        sortOrder: newStyle.sortOrder,
        isActive: true,
      }),
    });
    if (!res.ok) {
      toast.error("Could not add format");
      return;
    }
    toast.success("Book format added");
    setNewStyle({
      podPackageId: newStyle.podPackageId,
      name: "",
      description: "",
      trimWidthIn: 8.5,
      trimHeightIn: 11,
      coverBleedIn: 0.125,
      coverSafeMarginIn: 0.25,
      spineWidthIn: null,
      sortOrder: newStyle.sortOrder + 1,
    });
    load();
  };

  const savePricing = async () => {
    if (!pricing) return;
    setSavingPricing(true);
    try {
      const res = await fetch("/api/admin/print-pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: pricing.id,
          markupPercent: pricing.markupPercent,
          flatFeeCents: pricing.flatFeeCents,
          minRetailCents: pricing.minRetailCents,
          maxRetailCents: pricing.maxRetailCents,
          roundToNineteen: pricing.roundToNineteen,
        }),
      });
      if (!res.ok) {
        toast.error("Could not save pricing");
        return;
      }
      toast.success("Pricing saved");
      load();
    } finally {
      setSavingPricing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <Shield className="mx-auto mb-4 size-12 text-muted-foreground" />
        <p>{error}</p>
        <Link href="/admin" className="mt-4 inline-block text-primary underline">
          Admin home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
      <AppHeader />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link
          href="/admin"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Admin
        </Link>

        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="mb-2 flex items-center gap-2 text-2xl font-bold">
            <Package className="size-7" />
            Print on demand (Lulu)
          </h1>
          <p className="text-muted-foreground mb-8 text-sm">
            Enable ordering, set Lulu SKU and support email, adjust markup on top of Lulu&apos;s cost
            calculation. Webhook URL (register in Lulu):{" "}
            <code className="rounded bg-muted px-1">
              {typeof window !== "undefined" ? window.location.origin : ""}/api/lulu/webhook
            </code>
          </p>

          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Product</CardTitle>
                <CardDescription>
                  Turn on only when Lulu credentials and Stripe are ready. Set contact email for Lulu
                  print jobs (operations contact).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {config && (
                  <>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="printsEnabled"
                        checked={config.printsEnabled}
                        onChange={(e) =>
                          setConfig({ ...config, printsEnabled: e.target.checked })
                        }
                        className="size-4 rounded border"
                      />
                      <Label htmlFor="printsEnabled">Print ordering enabled</Label>
                    </div>
                    <div className="space-y-2">
                      <Label>Default POD package ID (legacy reference)</Label>
                      <Input
                        value={config.defaultPodPackageId}
                        onChange={(e) =>
                          setConfig({ ...config, defaultPodPackageId: e.target.value })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Checkout uses <strong>Book formats</strong> below. Keep this aligned with your
                        primary Lulu SKU if you rely on it elsewhere.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Lulu contact email</Label>
                      <Input
                        type="email"
                        value={config.contactEmail ?? ""}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            contactEmail: e.target.value.trim() || null,
                          })
                        }
                        placeholder="ops@yourcompany.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Default shipping option</Label>
                      <Input
                        value={config.defaultShippingOption}
                        onChange={(e) =>
                          setConfig({ ...config, defaultShippingOption: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Allowed options (comma-separated)</Label>
                      <Input
                        value={config.allowedShippingOptions.join(", ")}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            allowedShippingOptions: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </div>
                    <Button disabled={savingConfig} onClick={() => void saveConfig()}>
                      {savingConfig ? <Loader2 className="size-4 animate-spin" /> : "Save product"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Book formats</CardTitle>
                <CardDescription>
                  Only combinations you add here appear to customers. Each row is a Lulu{" "}
                  <code className="rounded bg-muted px-1">pod_package_id</code> plus trim size in
                  inches (interior PDF + preview). Cover PDFs use trim plus optional spine width;
                  bleed and safe margin keep back-cover text inside the trim safe zone. Leave spine
                  blank to derive from Lulu wrap width.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 pr-2">Active</th>
                        <th className="py-2 pr-2">Name</th>
                        <th className="py-2 pr-2">POD package ID</th>
                        <th className="py-2 pr-2">Trim W×H (in)</th>
                        <th className="py-2 pr-2">Bleed</th>
                        <th className="py-2 pr-2">Safe</th>
                        <th className="py-2 pr-2">Spine</th>
                        <th className="py-2 pr-2">Sort</th>
                        <th className="py-2 pr-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {bookStyles.map((s) => (
                        <tr key={s.id} className="border-b border-border/60 align-top">
                          <td className="py-2 pr-2">
                            <input
                              type="checkbox"
                              checked={s.isActive}
                              onChange={(e) =>
                                setBookStyles((rows) =>
                                  rows.map((r) =>
                                    r.id === s.id ? { ...r, isActive: e.target.checked } : r
                                  )
                                )
                              }
                              className="size-4"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <Input
                              value={s.name}
                              onChange={(e) =>
                                setBookStyles((rows) =>
                                  rows.map((r) =>
                                    r.id === s.id ? { ...r, name: e.target.value } : r
                                  )
                                )
                              }
                              className="min-w-[120px]"
                            />
                            <Input
                              value={s.description ?? ""}
                              placeholder="Description (customer-facing)"
                              onChange={(e) =>
                                setBookStyles((rows) =>
                                  rows.map((r) =>
                                    r.id === s.id
                                      ? { ...r, description: e.target.value || null }
                                      : r
                                  )
                                )
                              }
                              className="mt-1 min-w-[120px] text-xs"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <Input
                              value={s.podPackageId}
                              onChange={(e) =>
                                setBookStyles((rows) =>
                                  rows.map((r) =>
                                    r.id === s.id ? { ...r, podPackageId: e.target.value } : r
                                  )
                                )
                              }
                              className="min-w-[180px] font-mono text-xs"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <div className="flex gap-1">
                              <Input
                                type="number"
                                step="0.01"
                                value={s.trimWidthIn}
                                onChange={(e) =>
                                  setBookStyles((rows) =>
                                    rows.map((r) =>
                                      r.id === s.id
                                        ? { ...r, trimWidthIn: Number(e.target.value) || 0 }
                                        : r
                                    )
                                  )
                                }
                                className="w-20"
                              />
                              <span className="pt-2">×</span>
                              <Input
                                type="number"
                                step="0.01"
                                value={s.trimHeightIn}
                                onChange={(e) =>
                                  setBookStyles((rows) =>
                                    rows.map((r) =>
                                      r.id === s.id
                                        ? { ...r, trimHeightIn: Number(e.target.value) || 0 }
                                        : r
                                    )
                                  )
                                }
                                className="w-20"
                              />
                            </div>
                          </td>
                          <td className="py-2 pr-2">
                            <Input
                              type="number"
                              step="0.01"
                              title="Cover bleed (in), reference / layout"
                              value={s.coverBleedIn}
                              onChange={(e) =>
                                setBookStyles((rows) =>
                                  rows.map((r) =>
                                    r.id === s.id
                                      ? { ...r, coverBleedIn: Number(e.target.value) || 0 }
                                      : r
                                  )
                                )
                              }
                              className="w-16"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <Input
                              type="number"
                              step="0.01"
                              title="Text safe inset inside trim (in)"
                              value={s.coverSafeMarginIn}
                              onChange={(e) =>
                                setBookStyles((rows) =>
                                  rows.map((r) =>
                                    r.id === s.id
                                      ? {
                                          ...r,
                                          coverSafeMarginIn: Number(e.target.value) || 0,
                                        }
                                      : r
                                  )
                                )
                              }
                              className="w-16"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="auto"
                              title="Spine width (in), empty = from Lulu wrap"
                              value={s.spineWidthIn ?? ""}
                              onChange={(e) => {
                                const v = e.target.value.trim();
                                setBookStyles((rows) =>
                                  rows.map((r) =>
                                    r.id === s.id
                                      ? {
                                          ...r,
                                          spineWidthIn:
                                            v === "" ? null : Number(v) || null,
                                        }
                                      : r
                                  )
                                );
                              }}
                              className="w-16"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <Input
                              type="number"
                              value={s.sortOrder}
                              onChange={(e) =>
                                setBookStyles((rows) =>
                                  rows.map((r) =>
                                    r.id === s.id
                                      ? { ...r, sortOrder: Number(e.target.value) || 0 }
                                      : r
                                  )
                                )
                              }
                              className="w-16"
                            />
                          </td>
                          <td className="py-2 pr-2 whitespace-nowrap">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={savingStyleId === s.id}
                              onClick={() => void saveBookStyle(s)}
                            >
                              {savingStyleId === s.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                "Save"
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => void deleteBookStyle(s.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {bookStyles.length === 0 && (
                    <p className="text-muted-foreground py-4 text-sm">No formats yet. Add one below.</p>
                  )}
                </div>

                <div className="rounded-lg border bg-muted/20 p-4">
                  <p className="mb-3 text-sm font-medium">Add format</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Name</Label>
                      <Input
                        value={newStyle.name}
                        onChange={(e) => setNewStyle((n) => ({ ...n, name: e.target.value }))}
                        placeholder="e.g. Standard color paperback"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Description (optional)</Label>
                      <Input
                        value={newStyle.description}
                        onChange={(e) =>
                          setNewStyle((n) => ({ ...n, description: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>POD package ID</Label>
                      <Input
                        value={newStyle.podPackageId}
                        onChange={(e) =>
                          setNewStyle((n) => ({ ...n, podPackageId: e.target.value }))
                        }
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Trim width (in)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newStyle.trimWidthIn}
                        onChange={(e) =>
                          setNewStyle((n) => ({
                            ...n,
                            trimWidthIn: Number(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Trim height (in)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newStyle.trimHeightIn}
                        onChange={(e) =>
                          setNewStyle((n) => ({
                            ...n,
                            trimHeightIn: Number(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cover bleed (in)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newStyle.coverBleedIn}
                        onChange={(e) =>
                          setNewStyle((n) => ({
                            ...n,
                            coverBleedIn: Number(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Text safe margin (in)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newStyle.coverSafeMarginIn}
                        onChange={(e) =>
                          setNewStyle((n) => ({
                            ...n,
                            coverSafeMarginIn: Number(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Spine width (in, optional)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="auto from Lulu"
                        value={newStyle.spineWidthIn ?? ""}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          setNewStyle((n) => ({
                            ...n,
                            spineWidthIn: v === "" ? null : Number(v) || null,
                          }));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sort order</Label>
                      <Input
                        type="number"
                        value={newStyle.sortOrder}
                        onChange={(e) =>
                          setNewStyle((n) => ({
                            ...n,
                            sortOrder: Number(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-end">
                      <Button type="button" onClick={() => void addBookStyle()}>
                        <Plus className="mr-1 size-4" />
                        Add format
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pricing rules</CardTitle>
                <CardDescription>
                  Retail = (Lulu total incl. tax) × (1 + markup%) + flat fee, then min/max and optional
                  .99 rounding.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {pricing && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Markup %</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={pricing.markupPercent}
                          onChange={(e) =>
                            setPricing({
                              ...pricing,
                              markupPercent: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Flat fee (cents)</Label>
                        <Input
                          type="number"
                          value={pricing.flatFeeCents}
                          onChange={(e) =>
                            setPricing({
                              ...pricing,
                              flatFeeCents: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Min retail (cents, empty = none)</Label>
                        <Input
                          type="number"
                          value={pricing.minRetailCents ?? ""}
                          onChange={(e) =>
                            setPricing({
                              ...pricing,
                              minRetailCents: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max retail (cents, empty = none)</Label>
                        <Input
                          type="number"
                          value={pricing.maxRetailCents ?? ""}
                          onChange={(e) =>
                            setPricing({
                              ...pricing,
                              maxRetailCents: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="round99"
                        checked={pricing.roundToNineteen}
                        onChange={(e) =>
                          setPricing({ ...pricing, roundToNineteen: e.target.checked })
                        }
                        className="size-4 rounded border"
                      />
                      <Label htmlFor="round99">Round up to .99 in each dollar band</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Rule id: {pricing.id}
                      {pricing.isActive ? " (active)" : ""}
                    </p>
                    <Button disabled={savingPricing} onClick={() => void savePricing()}>
                      {savingPricing ? <Loader2 className="size-4 animate-spin" /> : "Save pricing"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent orders</CardTitle>
                <CardDescription>Stripe + Lulu status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 pr-2">When</th>
                        <th className="py-2 pr-2">Format</th>
                        <th className="py-2 pr-2">Status</th>
                        <th className="py-2 pr-2">Retail</th>
                        <th className="py-2 pr-2">Lulu job</th>
                        <th className="py-2 pr-2">Book</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id} className="border-b border-border/60">
                          <td className="py-2 pr-2 whitespace-nowrap">
                            {new Date(o.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2 pr-2 max-w-[140px]">
                            {o.printBookStyleId
                              ? bookStyles.find((b) => b.id === o.printBookStyleId)?.name ??
                                `${o.printBookStyleId.slice(0, 8)}…`
                              : o.podPackageId
                                ? `SKU…${o.podPackageId.slice(-8)}`
                                : "—"}
                          </td>
                          <td className="py-2 pr-2">{o.status}</td>
                          <td className="py-2 pr-2">
                            {(o.retailAmountCents / 100).toFixed(2)} {o.currency}
                          </td>
                          <td className="py-2 pr-2 font-mono text-xs">
                            {o.luluPrintJobId ?? "—"}
                            {o.luluJobStatus ? ` (${o.luluJobStatus})` : ""}
                          </td>
                          <td className="py-2 pr-2 font-mono text-xs">{o.bookId.slice(0, 8)}…</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {orders.length === 0 && (
                    <p className="text-muted-foreground py-6 text-center text-sm">No orders yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
