/**
 * Unified art-style catalog used by UI, validation, and prompt construction.
 * This is the product spec + implementation source of truth.
 */

export const ART_STYLE_IDS = [
  "whimsical-watercolor",
  "pixar-3d",
  "hand-drawn-classic",
  "vibrant-cartoon",
  "photo-realistic",
  "soft-storybook-watercolor",
  "flat-vector-cartoon",
  "crayon-hand-drawn",
  "cut-paper-collage",
  "classic-fairytale-illustration",
  "pastel-kawaii",
  "bold-comic-panel",
  "claymation-3d",
  "simple-anime-kids",
  "nature-sketch-wash",
  "retro-picture-book",
] as const;

export type ArtStyleId = (typeof ART_STYLE_IDS)[number];

export type ArtStyleSpec = {
  id: ArtStyleId;
  label: string;
  description: string;
  whyItWorks: string;
  promptDescriptor: string;
};

export const ART_STYLE_CATALOG: ArtStyleSpec[] = [
  {
    id: "whimsical-watercolor",
    label: "Whimsical Watercolor",
    description: "Soft, dreamy pastels",
    whyItWorks: "Gentle bedtime tone and forgiving brush texture for consistent pages.",
    promptDescriptor:
      "children's book illustration, whimsical watercolor, dreamy pastel palette, soft brush texture, warm magical mood",
  },
  {
    id: "pixar-3d",
    label: "Pixar-style 3D",
    description: "Vibrant and expressive",
    whyItWorks: "High emotional clarity and lively cinematic scenes for adventure stories.",
    promptDescriptor:
      "children's book illustration, stylized 3D animated film look, expressive faces, vibrant color, cinematic yet cozy lighting",
  },
  {
    id: "hand-drawn-classic",
    label: "Hand-drawn Classic",
    description: "Vintage storybook feel",
    whyItWorks: "Timeless picture-book look that prints well and feels familiar to families.",
    promptDescriptor:
      "children's book illustration, classic hand-drawn storybook ink and pencil linework, warm paper texture, timeless vintage feel",
  },
  {
    id: "vibrant-cartoon",
    label: "Vibrant Cartoon",
    description: "Bold and playful",
    whyItWorks: "Strong silhouettes and color contrast improve readability on mobile screens.",
    promptDescriptor:
      "children's book illustration, vibrant cartoon style, bold clean outlines, saturated colors, playful and energetic composition",
  },
  {
    id: "photo-realistic",
    label: "Photo Realistic",
    description: "Lifelike and cinematic",
    whyItWorks: "Premium look for families who prefer realistic portraits and environments.",
    promptDescriptor:
      "photorealistic family-friendly illustration, natural skin tones, realistic hair detail, soft diffused daylight, cinematic composition",
  },
  {
    id: "soft-storybook-watercolor",
    label: "Soft Storybook Watercolor",
    description: "Cozy painted bedtime look",
    whyItWorks: "Very age-appropriate calm mood and smooth scene-to-scene consistency.",
    promptDescriptor:
      "children's picture-book watercolor, soft edges, muted warm palette, cozy bedtime atmosphere, delicate paint blooms",
  },
  {
    id: "flat-vector-cartoon",
    label: "Flat Vector Cartoon",
    description: "Clean shapes and clarity",
    whyItWorks: "Excellent small-screen legibility and strong character recognizability.",
    promptDescriptor:
      "children's illustration, flat vector cartoon, simple geometric shapes, clean color blocks, high readability",
  },
  {
    id: "crayon-hand-drawn",
    label: "Crayon Hand-Drawn",
    description: "Kid-made playful texture",
    whyItWorks: "Feels creative and child-centered, ideal for early learning and fun prompts.",
    promptDescriptor:
      "children's crayon drawing style, hand-drawn wax texture, playful scribble strokes, bright classroom-friendly palette",
  },
  {
    id: "cut-paper-collage",
    label: "Cut-Paper Collage",
    description: "Crafty layered paper art",
    whyItWorks: "Distinctive handcrafted look with strong layered depth and shape clarity.",
    promptDescriptor:
      "children's cut-paper collage illustration, layered paper shapes, tactile edges, handcrafted classroom art style",
  },
  {
    id: "classic-fairytale-illustration",
    label: "Classic Fairytale",
    description: "Rich magical storybook",
    whyItWorks: "Ideal for fantasy prompts and keepsake books with a premium fairytale tone.",
    promptDescriptor:
      "classic fairytale children's illustration, ornate storybook details, luminous magical lighting, elegant composition",
  },
  {
    id: "pastel-kawaii",
    label: "Pastel Kawaii",
    description: "Cute soft rounded style",
    whyItWorks: "High appeal for younger children with gentle emotions and low visual intensity.",
    promptDescriptor:
      "kawaii children's illustration, pastel colors, rounded shapes, adorable expressions, soft minimal detail",
  },
  {
    id: "bold-comic-panel",
    label: "Bold Comic Panel",
    description: "Action-friendly storytelling",
    whyItWorks: "Great for dynamic adventures with clear pose, motion, and scene progression.",
    promptDescriptor:
      "children's comic-book illustration, bold outlines, dynamic action composition, clear visual storytelling, bright inks",
  },
  {
    id: "claymation-3d",
    label: "Claymation 3D",
    description: "Playful clay studio look",
    whyItWorks: "Adds premium tactile charm and depth without leaning into uncanny realism.",
    promptDescriptor:
      "stylized claymation children's illustration, soft clay texture, handcrafted 3D forms, warm studio lighting",
  },
  {
    id: "simple-anime-kids",
    label: "Simple Anime Kids",
    description: "Expressive clean anime look",
    whyItWorks: "Strong emotional expression and broad appeal for older kids.",
    promptDescriptor:
      "family-friendly anime-inspired children's illustration, clean line art, expressive eyes, simple shading, bright color design",
  },
  {
    id: "nature-sketch-wash",
    label: "Nature Sketch + Wash",
    description: "Educational field-journal vibe",
    whyItWorks: "Perfect for animals and nature themes with soft realism and clarity.",
    promptDescriptor:
      "nature sketch and watercolor wash children's illustration, pencil line detail, botanical field-journal feel, gentle natural palette",
  },
  {
    id: "retro-picture-book",
    label: "Retro Picture-Book",
    description: "Nostalgic mid-century charm",
    whyItWorks: "Distinctive brand style with nostalgic warmth that parents also love.",
    promptDescriptor:
      "mid-century retro picture-book illustration, limited warm palette, simple shapes, vintage print texture, nostalgic charm",
  },
];

export const ART_STYLE_BY_ID: Record<ArtStyleId, ArtStyleSpec> = Object.fromEntries(
  ART_STYLE_CATALOG.map((s) => [s.id, s])
) as Record<ArtStyleId, ArtStyleSpec>;

export const ART_STYLE_PROMPTS: Record<ArtStyleId, string> = Object.fromEntries(
  ART_STYLE_CATALOG.map((s) => [s.id, s.promptDescriptor])
) as Record<ArtStyleId, string>;

export function isArtStyleId(value: string): value is ArtStyleId {
  return (ART_STYLE_IDS as readonly string[]).includes(value);
}

export function getArtStylePrompt(styleId: string | null | undefined): string {
  if (styleId && isArtStyleId(styleId)) return ART_STYLE_PROMPTS[styleId];
  return ART_STYLE_PROMPTS["whimsical-watercolor"];
}

