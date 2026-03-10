/**
 * Generates voice sample MP3s for the create form voice selector.
 * Run: npm run generate-voice-samples
 * Requires: OPENAI_API_KEY in .env
 */

import "dotenv/config";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

const SAMPLE_PHRASE = "Once upon a time, in a magical land…";
/** tts-1 model supports 9 voices only (ballad, marin, verse, cedar require gpt-4o-mini-tts) */
const VOICES = [
  "alloy",
  "ash",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
] as const;

const OUT_DIR = path.join(process.cwd(), "public", "voice-samples");

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is required. Add it to .env");
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  for (const voice of VOICES) {
    const outPath = path.join(OUT_DIR, `${voice}.mp3`);
    console.log(`Generating ${voice}...`);
    try {
      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice,
        input: SAMPLE_PHRASE,
      });
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(outPath, buffer);
      console.log(`  Saved ${outPath}`);
    } catch (err) {
      console.error(`  Failed ${voice}:`, err);
    }
  }

  console.log("Done.");
}

main();
