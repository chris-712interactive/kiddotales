/**
 * Generates one example image per art style in the catalog.
 *
 * Run:
 *   npm run generate:style-previews
 *
 * Optional:
 *   npm run generate:style-previews -- --overwrite
 *   npm run generate:style-previews -- --style=whimsical-watercolor
 *
 * Requires:
 *   REPLICATE_API_TOKEN in .env
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { TransformStream } from "node:stream/web";
import { ART_STYLE_CATALOG, type ArtStyleId } from "@/lib/art-style-catalog";

const REPLICATE_FLUX_IMAGE_MODEL =
  "black-forest-labs/flux-2-pro" as `${string}/${string}`;
const REPLICATE_FLUX_IMAGE_RESOLUTION =
  process.env.REPLICATE_FLUX_RESOLUTION?.trim() || "4 MP";

const OUT_DIR = path.join(process.cwd(), "public", "artStyles", "previews");

const BASE_SCENE_PROMPT =
  "A cozy children's bedtime storybook scene of a smiling 6-year-old child in a yellow raincoat and boots, standing on a small wooden bridge in an enchanted forest with glowing fireflies and friendly forest animals in the distance, golden-hour light, whimsical composition, family-friendly G-rated mood, no text, no watermark";

const SAFETY_SUFFIX =
  "Wholesome children's picture-book scene, fully modest age-appropriate clothing, cheerful and innocent tone.";

function parseArgs() {
  const args = process.argv.slice(2);
  const overwrite = args.includes("--overwrite");
  const styleArg = args.find((a) => a.startsWith("--style="));
  const style = styleArg?.split("=")[1] as ArtStyleId | undefined;
  return { overwrite, style };
}

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
}

function outputPathForStyle(styleId: ArtStyleId): string {
  return path.join(OUT_DIR, `${styleId}.png`);
}

function resolveOutputUrl(output: unknown): string | null {
  const first = Array.isArray(output) ? output[0] : output;
  if (typeof first === "string") return first;
  if (
    first &&
    typeof first === "object" &&
    "url" in first &&
    typeof (first as { url: () => string }).url === "function"
  ) {
    return (first as { url: () => string }).url();
  }
  return null;
}

async function downloadToFile(url: string, outPath: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }
  const buf = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outPath, buf);
}

async function main() {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    console.error("REPLICATE_API_TOKEN is required. Add it to .env");
    process.exit(1);
  }

  // Some local Node setups don't expose TransformStream globally.
  if (!("TransformStream" in globalThis)) {
    (globalThis as typeof globalThis & { TransformStream: typeof TransformStream }).TransformStream =
      TransformStream;
  }
  const { default: Replicate } = await import("replicate");
  const replicate = new Replicate({ auth: token });
  const { overwrite, style } = parseArgs();
  const styles = style
    ? ART_STYLE_CATALOG.filter((s) => s.id === style)
    : ART_STYLE_CATALOG;

  if (style && styles.length === 0) {
    console.error(`Unknown style id: ${style}`);
    process.exit(1);
  }

  ensureOutDir();

  console.log(`Generating previews for ${styles.length} style(s)...`);

  for (const s of styles) {
    const outPath = outputPathForStyle(s.id);
    if (!overwrite && fs.existsSync(outPath)) {
      console.log(`Skipping ${s.id} (already exists)`);
      continue;
    }

    const prompt = `${BASE_SCENE_PROMPT}. Style direction: ${s.promptDescriptor}. ${SAFETY_SUFFIX}`;
    console.log(`Generating ${s.id}...`);

    try {
      const output = await replicate.run(REPLICATE_FLUX_IMAGE_MODEL, {
        input: {
          prompt,
          output_format: "png",
          aspect_ratio: "4:5",
          resolution: REPLICATE_FLUX_IMAGE_RESOLUTION,
          safety_tolerance: 4,
        },
      });
      const url = resolveOutputUrl(output);
      if (!url) {
        throw new Error("No output URL returned by Replicate");
      }
      await downloadToFile(url, outPath);
      console.log(`  Saved ${path.relative(process.cwd(), outPath)}`);
    } catch (err) {
      console.error(`  Failed ${s.id}:`, err);
    }

    // Keep generation friendly to model rate limits.
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log("Done.");
}

void main();

