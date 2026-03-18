"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, ShieldCheck, Download, FileUp } from "lucide-react";
import { Caveat, Dancing_Script } from "next/font/google";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AppHeader } from "@/components/app-header";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { buildW9Pdf, type W9FormData, type W9SignatureFont, type W9TaxClassification } from "@/lib/w9-pdf";

const caveatFont = Caveat({ subsets: ["latin"], weight: ["400", "700"] });
const dancingScriptFont = Dancing_Script({ subsets: ["latin"], weight: ["400", "700"] });

const SIGNATURE_FONT_OPTIONS: {
  id: W9SignatureFont;
  label: string;
  previewClassName?: string;
  previewStyle?: React.CSSProperties;
}[] = [
  { id: "helvetica", label: "Helvetica", previewStyle: { fontFamily: "Arial, Helvetica, sans-serif" } },
  { id: "helvetica_bold", label: "Helvetica Bold", previewStyle: { fontFamily: "Arial, Helvetica, sans-serif", fontWeight: 700 } },
  { id: "times", label: "Times Roman", previewStyle: { fontFamily: "'Times New Roman', Times, serif" } },
  { id: "courier", label: "Courier", previewStyle: { fontFamily: "'Courier New', Courier, monospace" } },
  { id: "handwriting", label: "Handwriting", previewClassName: caveatFont.className },
  { id: "cursive", label: "Cursive", previewClassName: dancingScriptFont.className },
];

function digitsOnly(s: string) {
  return s.replace(/\D+/g, "");
}

function formatSSN(raw: string) {
  const d = digitsOnly(raw).slice(0, 9);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

function formatEIN(raw: string) {
  const d = digitsOnly(raw).slice(0, 9);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}-${d.slice(2)}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ElectronicW9Page() {
  const router = useRouter();
  const { status } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfFilename, setPdfFilename] = useState<string>("");

  const [form, setForm] = useState({
    nameLine1: "",
    businessName: "",
    taxClassification: "individual" as W9TaxClassification,
    llcTaxClassification: "",
    otherTaxClassification: "",
    exemptions: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    accountNumbers: "",
    ssn: "",
    ein: "",
    certificationAccepted: false,
    signatureName: "",
    signedDateISO: new Date().toISOString().slice(0, 10),
    signatureFont: "helvetica" as W9SignatureFont,
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/sign-in?callbackUrl=/affiliate/w9");
    }
  }, [status, router]);

  const validation = useMemo(() => {
    const errors: string[] = [];
    if (!form.nameLine1.trim()) errors.push("Name is required");
    if (!form.taxClassification) errors.push("Tax classification is required");
    if (form.taxClassification === "llc" && !form.llcTaxClassification.trim()) errors.push("LLC classification is required");
    if (form.taxClassification === "other" && !form.otherTaxClassification.trim()) errors.push("Other classification is required");
    if (!form.address.trim()) errors.push("Address is required");
    if (!form.city.trim() || !form.state.trim() || !form.zip.trim()) errors.push("City/State/ZIP are required");

    const ssnDigits = digitsOnly(form.ssn);
    const einDigits = digitsOnly(form.ein);
    if ((ssnDigits && einDigits) || (!ssnDigits && !einDigits)) {
      errors.push("Provide either SSN or EIN (exactly one)");
    } else {
      if (ssnDigits && ssnDigits.length !== 9) errors.push("SSN must be 9 digits");
      if (einDigits && einDigits.length !== 9) errors.push("EIN must be 9 digits");
    }

    if (!form.certificationAccepted) errors.push("You must accept the certification");
    if (!form.signatureName.trim()) errors.push("Typed signature is required");
    if (!form.signedDateISO) errors.push("Date is required");
    return { ok: errors.length === 0, errors };
  }, [form]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.ok) {
      toast.error(validation.errors[0] ?? "Fix the errors");
      return;
    }

    setSubmitting(true);
    try {
      const data: W9FormData = {
        nameLine1: form.nameLine1.trim(),
        businessName: form.businessName.trim() || undefined,
        taxClassification: form.taxClassification,
        llcTaxClassification: form.llcTaxClassification.trim() || undefined,
        otherTaxClassification: form.otherTaxClassification.trim() || undefined,
        exemptions: form.exemptions.trim() || undefined,
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        zip: form.zip.trim(),
        accountNumbers: form.accountNumbers.trim() || undefined,
        ssn: digitsOnly(form.ssn) ? formatSSN(form.ssn) : undefined,
        ein: digitsOnly(form.ein) ? formatEIN(form.ein) : undefined,
        certificationAccepted: form.certificationAccepted,
        signatureName: form.signatureName.trim(),
        signedDateISO: form.signedDateISO,
        signatureFont: form.signatureFont ?? "helvetica",
      };

      let templateBytes: ArrayBuffer | undefined;
      try {
        // Prefer local fillable form if you add public/fw9.pdf (e.g. IRS fillable W-9)
        const localRes = await fetch("/fw9.pdf");
        if (localRes.ok) templateBytes = await localRes.arrayBuffer();
        else {
          const templateRes = await fetch("/api/w9-template");
          if (templateRes.ok) templateBytes = await templateRes.arrayBuffer();
        }
      } catch {
        // use text-only PDF
      }

      let customFontBytes: ArrayBuffer | undefined;
      let dataForPdf: W9FormData = data;
      if (data.signatureFont === "handwriting" || data.signatureFont === "cursive") {
        const fontPath = data.signatureFont === "handwriting" ? "/fonts/caveat.ttf" : "/fonts/dancing-script.ttf";
        try {
          const fontRes = await fetch(fontPath);
          if (fontRes.ok) customFontBytes = await fontRes.arrayBuffer();
          else {
            toast.error("Signature font not available. Using default font.");
            dataForPdf = { ...data, signatureFont: "helvetica" as W9SignatureFont };
          }
        } catch {
          toast.error("Signature font could not be loaded. Using default font.");
          dataForPdf = { ...data, signatureFont: "helvetica" as W9SignatureFont };
        }
      }

      const bytes = await buildW9Pdf(dataForPdf, templateBytes, customFontBytes);
      // Normalize to a plain Uint8Array backed by ArrayBuffer (avoids TS BlobPart incompatibilities).
      const normalized = Uint8Array.from(bytes as unknown as ArrayLike<number>);
      const blob = new Blob([normalized], { type: "application/pdf" });
      const year = new Date(form.signedDateISO).getFullYear();
      const filename = `w9-${year}.pdf`;
      setPdfBlob(blob);
      setPdfFilename(filename);

      // Give user their copy immediately
      downloadBlob(blob, filename);

      // Upload same PDF using existing signed upload flow
      const uploadRes = await fetch("/api/affiliate/tax-forms/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, mimeType: "application/pdf", sizeBytes: blob.size }),
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        toast.error(uploadData.error ?? "Failed to start upload");
        return;
      }

      const file = new File([blob], filename, { type: "application/pdf" });
      // Upload via direct PUT to signed URL so we don't hit Supabase RLS with anon client
      const putRes = await fetch(uploadData.signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/pdf" },
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
          mimeType: "application/pdf",
          sizeBytes: blob.size,
          year,
          source: "electronic",
          signedAt: new Date().toISOString(),
        }),
      });
      const completeData = await completeRes.json();
      if (!completeRes.ok) {
        toast.error(completeData.error ?? "Upload completed but metadata save failed");
        return;
      }

      toast.success("W-9 submitted");
    } catch {
      toast.error("Failed to submit W-9");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading" || status === "unauthenticated") {
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
          <Link href="/affiliate">
            <Button variant="ghost" size="sm" className="size-9 px-2 sm:size-auto sm:px-3">
              <ArrowLeft className="size-4 sm:mr-1" />
              <span className="hidden sm:inline">Affiliate</span>
            </Button>
          </Link>
        }
      />

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-8 md:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
          <section>
            <h1 className="text-2xl font-bold">Electronic W-9</h1>
            <p className="text-muted-foreground">Fill out and sign your W-9 electronically. You’ll download a copy and we’ll save it securely for payouts.</p>
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5" />
                W-9 information
              </CardTitle>
              <CardDescription>Enter your information carefully. For security, this data is not sent to the server as text—only the generated PDF is uploaded.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="nameLine1">Line 1: Name</Label>
                  <Input id="nameLine1" value={form.nameLine1} onChange={(e) => setForm((f) => ({ ...f, nameLine1: e.target.value }))} required />
                </div>
                <div>
                  <Label htmlFor="businessName">Line 2: Business name (optional)</Label>
                  <Input id="businessName" value={form.businessName} onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="taxClassification">Line 3: Tax classification</Label>
                    <Select
                      id="taxClassification"
                      value={form.taxClassification}
                      onChange={(e) => setForm((f) => ({ ...f, taxClassification: e.target.value as W9TaxClassification }))}
                      className="mt-1"
                    >
                      <option value="individual">Individual/sole proprietor</option>
                      <option value="c_corp">C corporation</option>
                      <option value="s_corp">S corporation</option>
                      <option value="partnership">Partnership</option>
                      <option value="trust_estate">Trust/estate</option>
                      <option value="llc">LLC</option>
                      <option value="other">Other</option>
                    </Select>
                  </div>
                  {form.taxClassification === "llc" && (
                    <div>
                      <Label htmlFor="llcTaxClassification">LLC classification (C/S/P)</Label>
                      <Input id="llcTaxClassification" value={form.llcTaxClassification} onChange={(e) => setForm((f) => ({ ...f, llcTaxClassification: e.target.value }))} />
                    </div>
                  )}
                  {form.taxClassification === "other" && (
                    <div>
                      <Label htmlFor="otherTaxClassification">Other classification</Label>
                      <Input id="otherTaxClassification" value={form.otherTaxClassification} onChange={(e) => setForm((f) => ({ ...f, otherTaxClassification: e.target.value }))} />
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="exemptions">Line 4: Exemptions (optional)</Label>
                  <Input id="exemptions" value={form.exemptions} onChange={(e) => setForm((f) => ({ ...f, exemptions: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="address">Line 5: Address</Label>
                  <Input id="address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} required />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="city">Line 6: City</Label>
                    <Input id="city" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} required />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input id="state" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} required />
                  </div>
                  <div>
                    <Label htmlFor="zip">ZIP</Label>
                    <Input id="zip" value={form.zip} onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))} required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="accountNumbers">Line 7: Account numbers (optional)</Label>
                  <Input id="accountNumbers" value={form.accountNumbers} onChange={(e) => setForm((f) => ({ ...f, accountNumbers: e.target.value }))} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="ssn">SSN (enter digits)</Label>
                    <Input
                      id="ssn"
                      inputMode="numeric"
                      value={form.ssn}
                      onChange={(e) => setForm((f) => ({ ...f, ssn: formatSSN(e.target.value), ein: f.ein ? "" : f.ein }))} // if SSN provided, clear EIN
                      placeholder="123-45-6789"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ein">EIN (enter digits)</Label>
                    <Input
                      id="ein"
                      inputMode="numeric"
                      value={form.ein}
                      onChange={(e) => setForm((f) => ({ ...f, ein: formatEIN(e.target.value), ssn: f.ssn ? "" : f.ssn }))} // if EIN provided, clear SSN
                      placeholder="12-3456789"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.certificationAccepted}
                      onChange={(e) => setForm((f) => ({ ...f, certificationAccepted: e.target.checked }))}
                      className="mt-1 rounded border-border"
                    />
                    <span>
                      I certify under penalties of perjury that the information provided is correct (as on the IRS Form W-9 certification).
                    </span>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="signatureName">Signature (typed full name)</Label>
                    <Input id="signatureName" value={form.signatureName} onChange={(e) => setForm((f) => ({ ...f, signatureName: e.target.value }))} required />
                  </div>
                  <div>
                    <Label htmlFor="signedDateISO">Date</Label>
                    <Input id="signedDateISO" type="date" value={form.signedDateISO} onChange={(e) => setForm((f) => ({ ...f, signedDateISO: e.target.value }))} required />
                  </div>
                </div>
                <div>
                  <Label>Signature font</Label>
                  <p className="mb-2 text-sm text-muted-foreground">Choose how your signature will look on the form.</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {SIGNATURE_FONT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, signatureFont: opt.id }))}
                        className={`flex flex-col items-start rounded-lg border-2 p-3 text-left transition-colors ${
                          form.signatureFont === opt.id
                            ? "border-primary bg-primary/5"
                            : "border-border bg-muted/20 hover:border-muted-foreground/40"
                        }`}
                      >
                        <span className="text-xs font-medium text-muted-foreground">{opt.label}</span>
                        <span
                          className={`mt-1 block text-base ${opt.previewClassName ?? ""}`}
                          style={opt.previewStyle}
                        >
                          {form.signatureName.trim() || "Your signature"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {!validation.ok && (
                  <p className="text-sm text-destructive">{validation.errors[0]}</p>
                )}

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="mr-2 size-4" />}
                  Generate PDF, download, and submit
                </Button>

                {pdfBlob && (
                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => downloadBlob(pdfBlob, pdfFilename || "w9.pdf")}
                    >
                      <Download className="mr-2 size-4" />
                      Download your copy again
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}

