"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Check, FileDown, Loader2, Package } from "lucide-react";
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
import {
  PrintBookStylePreview,
  bookToPreviewSources,
  type PrintPreviewStyle,
} from "@/components/print-book-style-preview";
import { cn } from "@/lib/utils";
import type { BookData } from "@/types";

const SHIPPING_LABELS: Record<string, string> = {
  MAIL: "Mail (economy)",
  PRIORITY_MAIL: "Priority Mail",
  GROUND_HD: "Ground (home)",
  GROUND_BUS: "Ground (business)",
  GROUND: "Ground",
  EXPEDITED: "Expedited",
  EXPRESS: "Express",
};

type ApiPrintStyle = {
  id: string;
  name: string;
  description: string | null;
  trimWidthIn: number;
  trimHeightIn: number;
  sortOrder: number;
};

type CoverTitleLayout = {
  x: number;
  y: number;
  width: number;
  fontSizePt: number;
  align: "left" | "center" | "right";
};

const DEFAULT_TITLE_LAYOUT: CoverTitleLayout = {
  x: 0.08,
  y: 0.07,
  width: 0.84,
  fontSizePt: 34,
  align: "center",
};

function PrintOrderForm() {
  const searchParams = useSearchParams();
  const bookId = searchParams.get("bookId")?.trim() ?? "";

  const [printConfig, setPrintConfig] = useState<{
    enabled: boolean;
    allowedShippingOptions: string[];
  } | null>(null);
  const [book, setBook] = useState<BookData | null>(null);
  const [loadingBook, setLoadingBook] = useState(false);
  const [printStyles, setPrintStyles] = useState<ApiPrintStyle[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    street1: "",
    street2: "",
    city: "",
    state_code: "",
    postcode: "",
    country_code: "US",
    phone_number: "",
    email: "",
    shippingOption: "MAIL",
  });

  const [quote, setQuote] = useState<{
    retailCents: number;
    currency: string;
    wholesaleTotalInclTax?: string;
    pageCount: number;
    previewInteriorPdfUrl: string | null;
    previewCoverPdfUrl: string | null;
    previewPdfError: string | null;
  } | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [titleLayout, setTitleLayout] = useState<CoverTitleLayout>(DEFAULT_TITLE_LAYOUT);
  const [savingLayout, setSavingLayout] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    fetch("/api/print/config")
      .then((r) => r.json())
      .then((d) => {
        setPrintConfig({
          enabled: Boolean(d.enabled),
          allowedShippingOptions: d.allowedShippingOptions ?? ["MAIL", "GROUND", "EXPRESS"],
        });
        if (d.defaultShippingOption && typeof d.defaultShippingOption === "string") {
          setForm((f) => ({ ...f, shippingOption: d.defaultShippingOption }));
        }
      })
      .catch(() => setPrintConfig({ enabled: false, allowedShippingOptions: [] }));
  }, []);

  useEffect(() => {
    fetch("/api/print/styles")
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d.styles) ? (d.styles as ApiPrintStyle[]) : [];
        setPrintStyles(list);
        setSelectedStyleId((prev) => {
          if (prev && list.some((s) => s.id === prev)) return prev;
          return list[0]?.id ?? null;
        });
      })
      .catch(() => setPrintStyles([]));
  }, []);

  useEffect(() => {
    if (!bookId) return;
    setLoadingBook(true);
    fetch(`/api/books/${bookId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (b) {
          const next = b as BookData;
          setBook(next);
          const saved = next.creationMetadata?.printCoverTitleLayout;
          if (saved) {
            setTitleLayout({
              x: saved.x,
              y: saved.y,
              width: saved.width,
              fontSizePt: saved.fontSizePt,
              align: saved.align,
            });
          } else {
            setTitleLayout(DEFAULT_TITLE_LAYOUT);
          }
        }
      })
      .finally(() => setLoadingBook(false));
  }, [bookId]);

  const persistTitleLayout = async () => {
    if (!bookId) return true;
    setSavingLayout(true);
    try {
      const res = await fetch(`/api/books/${encodeURIComponent(bookId)}/print-cover-layout`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: titleLayout }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not save cover title layout");
        return false;
      }
      return true;
    } finally {
      setSavingLayout(false);
    }
  };

  const selectedStyle = useMemo(
    () => printStyles.find((s) => s.id === selectedStyleId) ?? printStyles[0],
    [printStyles, selectedStyleId]
  );

  const previewStyle: PrintPreviewStyle | null = selectedStyle
    ? {
        id: selectedStyle.id,
        name: selectedStyle.name,
        trimWidthIn: selectedStyle.trimWidthIn,
        trimHeightIn: selectedStyle.trimHeightIn,
      }
    : null;

  const previewSources = book ? bookToPreviewSources(book) : null;
  const coverPreviewSrc = book?.coverImageData || book?.coverImageUrl || null;
  const coverTitlePreview = (book?.title || "KiddoTales Story").trim();
  const coverPreviewAspect = selectedStyle
    ? `${selectedStyle.trimWidthIn} / ${selectedStyle.trimHeightIn}`
    : "4 / 5";
  const previewTitleWidthPct = Math.min(95, Math.max(35, titleLayout.width * 100));
  const previewTitleLeftPct = Math.min(
    100 - previewTitleWidthPct,
    Math.max(0, (100 - previewTitleWidthPct) * titleLayout.x)
  );
  const previewTitleTopPct = Math.min(84, Math.max(4, 4 + titleLayout.y * 68));
  const previewTitleFontPx = Math.max(12, Math.min(36, titleLayout.fontSizePt * 0.62));

  const runQuote = async () => {
    if (!bookId) {
      toast.error("Missing book. Open this page from your book reader.");
      return;
    }
    if (!selectedStyleId) {
      toast.error("Choose a book format.");
      return;
    }
    setQuoting(true);
    setQuote(null);
    try {
      const saved = await persistTitleLayout();
      if (!saved) return;
      const res = await fetch("/api/print/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId,
          printBookStyleId: selectedStyleId,
          coverTitleLayout: titleLayout,
          shippingOption: form.shippingOption,
          shippingAddress: {
            name: form.name,
            street1: form.street1,
            ...(form.street2.trim() ? { street2: form.street2.trim() } : {}),
            city: form.city,
            postcode: form.postcode,
            country_code: form.country_code,
            ...(form.state_code.trim() ? { state_code: form.state_code.trim() } : {}),
            phone_number: form.phone_number,
            email: form.email,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not get quote");
        return;
      }
      setQuote({
        retailCents: data.retailCents,
        currency: data.currency ?? "USD",
        wholesaleTotalInclTax: data.wholesaleTotalInclTax,
        pageCount: data.pageCount,
        previewInteriorPdfUrl:
          typeof data.previewInteriorPdfUrl === "string"
            ? data.previewInteriorPdfUrl
            : null,
        previewCoverPdfUrl:
          typeof data.previewCoverPdfUrl === "string"
            ? data.previewCoverPdfUrl
            : null,
        previewPdfError:
          typeof data.previewPdfError === "string" ? data.previewPdfError : null,
      });
      if (data.previewPdfError) {
        toast.warning("Quote ready, but preview PDFs could not be generated");
      } else {
        toast.success("Quote ready — download Lulu preview PDFs below");
      }
    } finally {
      setQuoting(false);
    }
  };

  const runCheckout = async () => {
    if (!bookId || !selectedStyleId) {
      toast.error("Choose a book format.");
      return;
    }
    setCheckingOut(true);
    try {
      const saved = await persistTitleLayout();
      if (!saved) return;
      const res = await fetch("/api/print/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId,
          printBookStyleId: selectedStyleId,
          shippingOption: form.shippingOption,
          shippingAddress: {
            name: form.name,
            street1: form.street1,
            ...(form.street2.trim() ? { street2: form.street2.trim() } : {}),
            city: form.city,
            postcode: form.postcode,
            country_code: form.country_code,
            ...(form.state_code.trim() ? { state_code: form.state_code.trim() } : {}),
            phone_number: form.phone_number,
            email: form.email,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Checkout failed");
        return;
      }
      if (data.url) {
        window.location.href = data.url as string;
      }
    } finally {
      setCheckingOut(false);
    }
  };

  const hasShippingDetails =
    form.name.trim().length > 0 &&
    form.street1.trim().length > 0 &&
    form.city.trim().length > 0 &&
    form.postcode.trim().length > 0 &&
    form.country_code.trim().length === 2 &&
    form.phone_number.trim().length > 0 &&
    form.email.trim().length > 0;

  const canProceedFromStep = (step: number) => {
    if (step === 1) return Boolean(selectedStyleId);
    if (step === 2) return hasShippingDetails;
    if (step === 3) return Boolean(form.shippingOption);
    return true;
  };

  const goToStep = (step: number) => {
    if (step < 1 || step > 5) return;
    if (step > currentStep && !canProceedFromStep(currentStep)) {
      toast.error(
        currentStep === 2
          ? "Please complete all required shipping details."
          : "Please complete this step first."
      );
      return;
    }
    setCurrentStep(step);
  };

  if (!bookId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-muted-foreground mb-4">No book selected.</p>
        <Link href="/settings">
          <Button variant="outline">Settings</Button>
        </Link>
      </div>
    );
  }

  if (printConfig && !printConfig.enabled) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Package className="mx-auto mb-4 size-12 text-muted-foreground" />
        <p className="text-muted-foreground">Printed copies are not available right now.</p>
        <Link href={`/book?id=${encodeURIComponent(bookId)}`} className="mt-6 inline-block">
          <Button variant="outline">Back to book</Button>
        </Link>
      </div>
    );
  }

  const formatMoney = (cents: number, currency: string) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-2xl px-4 py-10"
    >
      <Link
        href={`/book?id=${encodeURIComponent(bookId)}`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to book
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="size-5" />
            Order a printed copy
          </CardTitle>
          <CardDescription>
            {loadingBook ? "Loading…" : book?.title ? `“${book.title}”` : "Your story"}
            {" · "}
            Fulfilled by Lulu (print-on-demand). Price includes our margin on top of Lulu&apos;s estimate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              "Format",
              "Shipping details",
              "Shipping method",
              "Cover layout",
              "Quote + downloads",
            ].map((label, idx) => {
              const step = idx + 1;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => goToStep(step)}
                  className={cn(
                    "flex min-h-10 items-center gap-2 rounded-full px-4 py-1.5 text-sm touch-manipulation transition-all active:scale-[0.98] sm:active:scale-100",
                    currentStep === step
                      ? "bg-primary text-primary-foreground shadow-md"
                      : step < currentStep
                        ? "bg-primary/20 text-primary hover:bg-primary/30"
                        : "bg-muted/50 text-muted-foreground"
                  )}
                >
                  <span className="max-w-[8.5rem] truncate sm:max-w-none">{label}</span>
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-current/20 text-xs font-semibold">
                    {step}
                  </span>
                </button>
              );
            })}
          </div>

          {printStyles.length === 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              No book formats are available yet. Ask an admin to add approved styles in Admin → Print.
            </p>
          ) : null}

          {currentStep === 1 && printStyles.length > 0 && (
            <>
              <div className="space-y-3">
                <Label>Book format</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {printStyles.map((s) => {
                    const selected = selectedStyleId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedStyleId(s.id);
                          setQuote(null);
                        }}
                        className={cn(
                          "rounded-xl border-2 p-3 text-left text-sm transition-colors",
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        )}
                      >
                        <span className="flex items-start justify-between gap-2 font-medium">
                          {s.name}
                          {selected ? (
                            <Check className="size-4 shrink-0 text-primary" aria-hidden />
                          ) : null}
                        </span>
                        {s.description ? (
                          <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                        ) : null}
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Trim {s.trimWidthIn}″ × {s.trimHeightIn}″
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {previewStyle && previewSources ? (
                <div className="rounded-xl border bg-muted/30 p-4">
                  <PrintBookStylePreview
                    style={previewStyle}
                    coverSrc={previewSources.coverSrc}
                    spreadImageSrc={previewSources.spreadImageSrc}
                    spreadText={previewSources.spreadText}
                    hasDedication={previewSources.hasDedication}
                  />
                </div>
              ) : null}
            </>
          )}

          {currentStep === 2 && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoComplete="name" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="email">Email (shipping updates)</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} autoComplete="email" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="street1">Street address</Label>
                <Input id="street1" value={form.street1} onChange={(e) => setForm((f) => ({ ...f, street1: e.target.value }))} autoComplete="street-address" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="street2">Apt / suite (optional)</Label>
                <Input id="street2" value={form.street2} onChange={(e) => setForm((f) => ({ ...f, street2: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state_code">State / province</Label>
                <Input id="state_code" value={form.state_code} onChange={(e) => setForm((f) => ({ ...f, state_code: e.target.value }))} placeholder="e.g. CA" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postcode">Postal code</Label>
                <Input id="postcode" value={form.postcode} onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country_code">Country (ISO-2)</Label>
                <Input
                  id="country_code"
                  value={form.country_code}
                  onChange={(e) => setForm((f) => ({ ...f, country_code: e.target.value.toUpperCase().slice(0, 2) }))}
                  maxLength={2}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="phone_number">Phone (required by carriers)</Label>
                <Input id="phone_number" value={form.phone_number} onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))} autoComplete="tel" />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-2">
              <Label htmlFor="shipping">Shipping method</Label>
              <select
                id="shipping"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.shippingOption}
                onChange={(e) => setForm((f) => ({ ...f, shippingOption: e.target.value }))}
              >
                {(printConfig?.allowedShippingOptions ?? ["MAIL", "GROUND", "EXPRESS"]).map((opt) => (
                  <option key={opt} value={opt}>
                    {SHIPPING_LABELS[opt] ?? opt}
                  </option>
                ))}
              </select>
            </div>
          )}

          {currentStep === 4 && (
            <div className="rounded-lg border bg-background p-4 space-y-3">
            <p className="text-sm font-medium">Cover title layout</p>
            <p className="text-xs text-muted-foreground">
              We auto-place the title from image negative space; adjust if you want.
            </p>
            {coverPreviewSrc ? (
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="mb-2 text-xs text-muted-foreground">
                  Live front-cover preview (approximate placement)
                </p>
                <div className="mx-auto w-full max-w-[320px]">
                  <div
                    className="relative overflow-hidden rounded-md border bg-black"
                    style={{ aspectRatio: coverPreviewAspect }}
                  >
                    <img
                      src={coverPreviewSrc}
                      alt="Cover preview"
                      className="h-full w-full object-cover"
                    />
                    <div
                      className="absolute rounded-sm bg-[#0f1526]/60 px-2 py-1"
                      style={{
                        left: `${previewTitleLeftPct}%`,
                        top: `${previewTitleTopPct}%`,
                        width: `${previewTitleWidthPct}%`,
                      }}
                    >
                      <p
                        className="line-clamp-3 text-[#f8fbff]"
                        style={{
                          fontSize: `${previewTitleFontPx}px`,
                          lineHeight: 1.15,
                          textAlign: titleLayout.align,
                        }}
                      >
                        {coverTitlePreview}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Cover preview unavailable for this book, but layout values will still be saved.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Horizontal position</Label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={titleLayout.x}
                  onChange={(e) =>
                    setTitleLayout((v) => ({ ...v, x: Number(e.target.value) }))
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setTitleLayout((v) => ({ ...v, x: 0 }))}
                  >
                    Left
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setTitleLayout((v) => ({ ...v, x: 0.5 }))}
                  >
                    Center
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setTitleLayout((v) => ({ ...v, x: 1 }))}
                  >
                    Right
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Vertical position</Label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={titleLayout.y}
                  onChange={(e) =>
                    setTitleLayout((v) => ({ ...v, y: Number(e.target.value) }))
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setTitleLayout((v) => ({ ...v, y: 0 }))}
                  >
                    Top
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setTitleLayout((v) => ({ ...v, y: 0.5 }))}
                  >
                    Center
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setTitleLayout((v) => ({ ...v, y: 1 }))}
                  >
                    Bottom
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Title width</Label>
                <input
                  type="range"
                  min={0.35}
                  max={0.95}
                  step={0.01}
                  value={titleLayout.width}
                  onChange={(e) =>
                    setTitleLayout((v) => ({ ...v, width: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Font size</Label>
                <input
                  type="range"
                  min={16}
                  max={64}
                  step={1}
                  value={titleLayout.fontSizePt}
                  onChange={(e) =>
                    setTitleLayout((v) => ({ ...v, fontSizePt: Number(e.target.value) }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Alignment</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={titleLayout.align}
                onChange={(e) =>
                  setTitleLayout((v) => ({
                    ...v,
                    align: e.target.value as CoverTitleLayout["align"],
                  }))
                }
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={savingLayout}
                onClick={() => void persistTitleLayout()}
              >
                {savingLayout ? <Loader2 className="size-4 animate-spin" /> : "Save layout"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setTitleLayout(DEFAULT_TITLE_LAYOUT)}
              >
                Reset
              </Button>
            </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={quoting || !selectedStyleId || printStyles.length === 0}
                  onClick={runQuote}
                >
                  {quoting ? <Loader2 className="size-4 animate-spin" /> : "Submit for quote"}
                </Button>
                <Button
                  type="button"
                  disabled={checkingOut || !selectedStyleId || printStyles.length === 0}
                  onClick={() => {
                    void runCheckout();
                  }}
                >
                  {checkingOut ? <Loader2 className="size-4 animate-spin" /> : "Pay with Stripe"}
                </Button>
              </div>
              {quote ? (
                <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-3">
                  <p className="font-medium">
                    Your quoted price: {formatMoney(quote.retailCents, quote.currency)}
                  </p>
                  {quote.wholesaleTotalInclTax != null && (
                    <p className="text-muted-foreground">
                      Lulu estimate (incl. tax): {quote.wholesaleTotalInclTax}{" "}
                      {quote.currency} · {quote.pageCount} interior pages
                    </p>
                  )}
                  {quote.previewInteriorPdfUrl && quote.previewCoverPdfUrl ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <a
                        href={quote.previewInteriorPdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className={cn(
                          "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl h-9 px-4 text-sm font-medium transition-all",
                          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        )}
                      >
                        <FileDown className="size-4 shrink-0" />
                        Interior PDF (Lulu)
                      </a>
                      <a
                        href={quote.previewCoverPdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className={cn(
                          "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl h-9 px-4 text-sm font-medium transition-all",
                          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        )}
                      >
                        <FileDown className="size-4 shrink-0" />
                        Cover PDF (Lulu)
                      </a>
                    </div>
                  ) : quote.previewPdfError ? (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Preview PDFs unavailable: {quote.previewPdfError}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Submit for quote to see your quoted price and Lulu template downloads.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              disabled={currentStep <= 1}
              onClick={() => goToStep(currentStep - 1)}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={currentStep >= 5 || !canProceedFromStep(currentStep)}
              onClick={() => goToStep(currentStep + 1)}
            >
              Next step
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function PrintOrderPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--pastel-mint)]/40 via-background to-background">
      <AppHeader />
      <Suspense
        fallback={
          <div className="flex justify-center py-24">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <PrintOrderForm />
      </Suspense>
    </div>
  );
}
