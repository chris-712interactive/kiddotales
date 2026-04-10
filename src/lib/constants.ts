/**
 * KiddoTales prompts and constants
 * Story generation uses STORY_SYSTEM_PROMPT from @/lib/prompts (this duplicate is legacy / unused by the API).
 */
import { ART_STYLE_BY_ID, ART_STYLE_PROMPTS, type ArtStyleId } from "@/lib/art-style-catalog";
export { ART_STYLE_PROMPTS };

export const STORY_SYSTEM_PROMPT = `You are a magical children's story writer. Create personalized bedtime stories that are warm, gentle, and perfect for young children.

RULES:
1. Output ONLY valid JSON - no markdown, no code blocks, no extra text
2. The story must have exactly 8 pages
3. Each page should have 2-4 short sentences (age-appropriate, simple vocabulary)
4. Use the child's name throughout the story
5. Weave in their interests naturally
6. Center the story around the chosen life lesson
7. Make it cozy and calming - perfect for bedtime
8. Use the pronoun provided for the child

OUTPUT FORMAT (strict JSON):
{
  "title": "Story title (whimsical, engaging)",
  "pages": [
    {
      "pageNumber": 1,
      "text": "Page text for reading aloud...",
      "imagePrompt": "Detailed image description for AI image generation - describe the scene, characters, style, lighting. Be specific about the child character's appearance based on the story context. No text in image."
    },
    ... (8 pages total)
  ]
}

The imagePrompt should be detailed (2-3 sentences), describe the visual scene, character actions, mood, and art style. Include "children's book illustration" and the art style in each prompt.`;

export const getStoryUserPrompt = (params: {
  childName: string;
  age: number;
  pronouns: string;
  interests: string[];
  lifeLesson: string;
  artStyle: string;
  appearance?: { hairColor?: string; hairStyle?: string; skinTone?: string; eyeColor?: string; glasses?: boolean; freckles?: boolean };
}) => {
  const styleSpec = ART_STYLE_BY_ID[
    (params.artStyle as ArtStyleId) in ART_STYLE_BY_ID
      ? (params.artStyle as ArtStyleId)
      : "whimsical-watercolor"
  ];

  const appearanceParts: string[] = [];
  if (params.appearance?.hairColor) appearanceParts.push(`${params.appearance.hairColor} hair`);
  if (params.appearance?.hairStyle) appearanceParts.push(params.appearance.hairStyle);
  if (params.appearance?.skinTone) appearanceParts.push(`${params.appearance.skinTone} skin`);
  if (params.appearance?.eyeColor) appearanceParts.push(`${params.appearance.eyeColor} eyes`);
  if (params.appearance?.glasses) appearanceParts.push("glasses");
  if (params.appearance?.freckles) appearanceParts.push("freckles");
  const appearanceLine =
    appearanceParts.length > 0
      ? `\n- Character appearance (use in characterDescription): ${appearanceParts.join(", ")}`
      : "";
  const photoRealisticHint =
    params.artStyle === "photo-realistic"
      ? "\n- For photorealistic art style: characterDescription and secondaryCharacterDescription must be very detailed (e.g. skin tone nuances, hair texture, eye shape, natural proportions, fabric detail) so images render lifelike."
      : "";

  return `Create a personalized bedtime story with these details:

- Child's name: ${params.childName}
- Age: ${params.age} years old
- Pronouns: ${params.pronouns}
- Interests: ${params.interests.join(", ")}
- Life lesson to teach: ${params.lifeLesson}
- Art style for images: ${styleSpec.label} — ${styleSpec.description}. Rendering direction: ${styleSpec.promptDescriptor}${appearanceLine}${photoRealisticHint}

Generate the complete story as JSON. Remember: exactly 8 pages, each with text and a detailed imagePrompt.

Content must stay innocent for ages 3-10: no adult, romantic, or sexual themes; no gender-transition or sexuality topics; illustration prompts must show everyone fully modestly clothed (no nudity, bathing, or undressing scenes).`;
};

export const BOOK_HISTORY_KEY = "kiddotales-book-history";
export const PENDING_BOOK_KEY = "kiddotales-pending-book";
export const PENDING_CORRECTION_KEY = "kiddotales-pending-correction";
export const PREFETCH_BOOK_KEY_PREFIX = "kiddotales-prefetch-";
export const MAX_HISTORY_BOOKS = 5;
