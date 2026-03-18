import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type W9TaxClassification =
  | "individual"
  | "c_corp"
  | "s_corp"
  | "partnership"
  | "trust_estate"
  | "llc"
  | "other";

/** Font choice for the signature line on the W-9 (standard + optional custom TTF). */
export type W9SignatureFont = "helvetica" | "times" | "courier" | "helvetica_bold" | "handwriting" | "cursive";

export type W9FormData = {
  nameLine1: string;
  businessName?: string;
  taxClassification: W9TaxClassification;
  llcTaxClassification?: string; // only when taxClassification === 'llc'
  otherTaxClassification?: string; // only when taxClassification === 'other'
  exemptions?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  accountNumbers?: string;
  ssn?: string; // digits or ###-##-####
  ein?: string; // digits or ##-#######
  certificationAccepted: boolean;
  signatureName: string;
  signedDateISO: string; // YYYY-MM-DD
  signatureFont?: W9SignatureFont;
};

function drawLabelValue(
  page: { drawText: (t: string, o: object) => void },
  font: unknown,
  label: string,
  value: string,
  x: number,
  y: number
) {
  page.drawText(label, { x, y, size: 9, font, color: rgb(0.35, 0.35, 0.35) });
  page.drawText(value || "—", { x: x + 140, y, size: 11, font, color: rgb(0, 0, 0) });
}

const PREFIX = "topmostSubform[0].Page1[0]";
const BOXES = "Boxes3a-b_ReadOrder[0]";
const ADDR = "Address_ReadOrder[0]";

function setText(form: ReturnType<PDFDocument["getForm"]>, name: string, value: string): boolean {
  try {
    const field = form.getFieldMaybe(name);
    if (field && "setText" in field && typeof (field as { setText: (s: string) => void }).setText === "function") {
      (field as { setText: (s: string) => void }).setText(value);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

function setCheck(form: ReturnType<PDFDocument["getForm"]>, name: string, checked: boolean): boolean {
  try {
    const box = form.getCheckBox(name);
    if (checked) box.check();
    else box.uncheck();
    return true;
  } catch {
    return false;
  }
}

/** Fill official IRS W-9 using Adobe Acrobat field names. Returns true if at least one field was set. */
function tryFillW9Form(
  data: W9FormData,
  form: ReturnType<PDFDocument["getForm"]>
): boolean {
  let filled = 0;

  // Field 1: Name (Line 1)
  if (setText(form, `${PREFIX}.f1_01[0]`, data.nameLine1)) filled++;

  // Field 2: Business name (Line 2)
  if (setText(form, `${PREFIX}.f1_02[0]`, data.businessName ?? "")) filled++;

  // Field 3a: Tax classification checkboxes (check one)
  const taxCheckboxes = [
    "individual",
    "c_corp",
    "s_corp",
    "partnership",
    "trust_estate",
    "llc",
    "other",
  ] as const;
  const boxName = (i: number) => `${PREFIX}.${BOXES}.c1_1[${i}]`;
  for (let i = 0; i < taxCheckboxes.length; i++) {
    if (setCheck(form, boxName(i), data.taxClassification === taxCheckboxes[i])) filled++;
  }

  // LLC classification input (when LLC)
  if (setText(form, `${PREFIX}.${BOXES}.f1_03[0]`, data.llcTaxClassification ?? "")) filled++;
  // Other classification input (when Other)
  if (setText(form, `${PREFIX}.${BOXES}.f1_04[0]`, data.otherTaxClassification ?? "")) filled++;

  // Field 4: Exempt payee code / FATCA (exemptions - use first box; optional second)
  const exemptParts = (data.exemptions ?? "").split(/[\s,]+/).filter(Boolean);
  if (setText(form, `${PREFIX}.f1_05[0]`, exemptParts[0] ?? "")) filled++;
  if (setText(form, `${PREFIX}.f1_06[0]`, exemptParts[1] ?? "")) filled++;

  // Field 5: Address
  if (setText(form, `${PREFIX}.${ADDR}.f1_07[0]`, data.address)) filled++;
  // Field 6: City, State ZIP
  const cityStateZip = `${data.city}, ${data.state} ${data.zip}`;
  if (setText(form, `${PREFIX}.${ADDR}.f1_08[0]`, cityStateZip)) filled++;

  // Field 7: Account numbers
  if (setText(form, `${PREFIX}.f1_10[0]`, data.accountNumbers ?? "")) filled++;

  // Part I TIN: SSN (3 + 2 + 4 digits) or EIN (2 + 7 digits)
  const ssnDigits = (data.ssn ?? "").replace(/\D/g, "");
  const einDigits = (data.ein ?? "").replace(/\D/g, "");
  if (ssnDigits.length >= 9) {
    if (setText(form, `${PREFIX}.f1_11[0]`, ssnDigits.slice(0, 3))) filled++;
    if (setText(form, `${PREFIX}.f1_12[0]`, ssnDigits.slice(3, 5))) filled++;
    if (setText(form, `${PREFIX}.f1_13[0]`, ssnDigits.slice(5, 9))) filled++;
  } else if (einDigits.length >= 9) {
    if (setText(form, `${PREFIX}.f1_14[0]`, einDigits.slice(0, 2))) filled++;
    if (setText(form, `${PREFIX}.f1_15[0]`, einDigits.slice(2, 9))) filled++;
  }

  return filled > 0;
}

const STANDARD_SIGNATURE_FONTS: Record<Exclude<W9SignatureFont, "handwriting" | "cursive">, (typeof StandardFonts)[keyof typeof StandardFonts]> = {
  helvetica: StandardFonts.Helvetica,
  helvetica_bold: StandardFonts.HelveticaBold,
  times: StandardFonts.TimesRoman,
  courier: StandardFonts.Courier,
};

/** Draw signature and date on the W-9 first page (no form fields for these). Coordinates for US Letter. */
async function drawSignatureAndDate(
  pdf: PDFDocument,
  signatureName: string,
  signedDateISO: string,
  signatureFont: W9SignatureFont = "helvetica",
  customFontBytes?: ArrayBuffer
): Promise<void> {
  const pages = pdf.getPages();
  if (pages.length === 0) return;
  const page = pages[0];

  const y = 202.25;
  const sigFontSize = 10;
  const sigX = 123.06;
  const standardFont = await pdf.embedFont(StandardFonts.Helvetica);

  // Try to use the selected signature font; on any failure (e.g. Cursive/Dancing Script embed or draw),
  // fall back to Helvetica so we still return the filled W-9 form instead of the text-only fallback.
  let signatureNameFont: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  try {
    if ((signatureFont === "handwriting" || signatureFont === "cursive") && customFontBytes && customFontBytes.byteLength > 0) {
      (pdf as PDFDocument & { registerFontkit: (f: unknown) => void }).registerFontkit(fontkit);
      signatureNameFont = await pdf.embedFont(new Uint8Array(customFontBytes), { subset: false });
    } else {
      const standard = STANDARD_SIGNATURE_FONTS[signatureFont as keyof typeof STANDARD_SIGNATURE_FONTS] ?? StandardFonts.Helvetica;
      signatureNameFont = await pdf.embedFont(standard);
    }
  } catch {
    signatureNameFont = standardFont;
  }

  try {
    if (signatureFont === "handwriting" || signatureFont === "cursive") {
      let x = sigX;
      const fontWithWidth = signatureNameFont as { widthOfTextAtSize: (t: string, s: number) => number };
      for (const char of signatureName) {
        page.drawText(char, { x, y, size: sigFontSize, font: signatureNameFont, color: rgb(0, 0, 0) });
        x += fontWithWidth.widthOfTextAtSize(char, sigFontSize);
      }
    } else {
      page.drawText(signatureName, { x: sigX, y, size: sigFontSize, font: signatureNameFont, color: rgb(0, 0, 0) });
    }
  } catch {
    page.drawText(signatureName, { x: sigX, y, size: sigFontSize, font: standardFont, color: rgb(0, 0, 0) });
  }

  page.drawText(signedDateISO, { x: 405.82, y, size: 10, font: standardFont, color: rgb(0, 0, 0) });
  page.drawText("Electronic signature", {
    x: 123.06,
    y: y - 8,
    size: 7,
    font: standardFont,
    color: rgb(0.3, 0.3, 0.3),
  });
}

function buildTextOnlyW9(data: W9FormData): Promise<Uint8Array> {
  return (async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]); // US Letter
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    page.drawText("Form W-9 (Electronic)", { x: 50, y: 750, size: 18, font: bold });
    page.drawText("Request for Taxpayer Identification Number and Certification", {
      x: 50,
      y: 730,
      size: 10,
      font,
      color: rgb(0.25, 0.25, 0.25),
    });

    let y = 690;
    const lineGap = 22;
    drawLabelValue(page, font, "Line 1 (Name)", data.nameLine1, 50, y);
    y -= lineGap;
    drawLabelValue(page, font, "Line 2 (Business name)", data.businessName ?? "", 50, y);
    const classification = (() => {
      if (data.taxClassification === "llc") return `LLC (${data.llcTaxClassification ?? "—"})`;
      if (data.taxClassification === "other") return `Other (${data.otherTaxClassification ?? "—"})`;
      return data.taxClassification.replace("_", " ").toUpperCase();
    })();
    drawLabelValue(page, font, "Line 3 (Tax classification)", classification, 50, y);
    y -= lineGap;
    drawLabelValue(page, font, "Line 4 (Exemptions)", data.exemptions ?? "", 50, y);
    y -= lineGap;
    drawLabelValue(page, font, "Line 5 (Address)", data.address, 50, y);
    y -= lineGap;
    drawLabelValue(page, font, "Line 6 (City/State/ZIP)", `${data.city}, ${data.state} ${data.zip}`, 50, y);
    y -= lineGap;
    drawLabelValue(page, font, "Line 7 (Account numbers)", data.accountNumbers ?? "", 50, y);
    y -= lineGap * 1.2;

    page.drawText("Part I — Taxpayer Identification Number (TIN)", { x: 50, y, size: 12, font: bold });
    y -= 18;
    const tin = data.ssn ? `SSN: ${data.ssn}` : data.ein ? `EIN: ${data.ein}` : "—";
    page.drawText(tin, { x: 50, y, size: 11, font });
    y -= 28;

    page.drawText("Part II — Certification", { x: 50, y, size: 12, font: bold });
    y -= 16;
    page.drawText(
      `Under penalties of perjury, I certify that the information provided is correct. Accepted: ${
        data.certificationAccepted ? "Yes" : "No"
      }`,
      { x: 50, y, size: 10, font }
    );
    y -= 28;

    page.drawText("Electronic signature", { x: 50, y, size: 12, font: bold });
    y -= 18;
    drawLabelValue(page, font, "Signature (typed name)", data.signatureName, 50, y);
    y -= lineGap;
    drawLabelValue(page, font, "Date", data.signedDateISO, 50, y);

    return await pdf.save();
  })();
}

/**
 * Build a W-9 PDF from form data. If templateBytes (e.g. from GET /api/w9-template) is
 * provided and is a fillable IRS W-9, fields are filled on that form; otherwise a
 * text-only PDF is generated.
 * When signatureFont is "handwriting" or "cursive", pass the corresponding TTF bytes
 * in customSignatureFontBytes (e.g. from /fonts/caveat.ttf or /fonts/dancing-script.ttf).
 */
export async function buildW9Pdf(
  data: W9FormData,
  templateBytes?: ArrayBuffer,
  customSignatureFontBytes?: ArrayBuffer
): Promise<Uint8Array> {
  if (templateBytes && templateBytes.byteLength > 0) {
    try {
      const pdf = await PDFDocument.load(new Uint8Array(templateBytes), { ignoreEncryption: true });
      const form = pdf.getForm();
      if (form.hasXFA()) form.deleteXFA();
      const fields = form.getFields();
      if (fields.length > 0 && tryFillW9Form(data, form)) {
        await drawSignatureAndDate(
          pdf,
          data.signatureName,
          data.signedDateISO,
          data.signatureFont ?? "helvetica",
          customSignatureFontBytes
        );
        form.flatten();
        return await pdf.save();
      }
    } catch {
      // fall through to text-only
    }
  }
  return buildTextOnlyW9(data);
}

