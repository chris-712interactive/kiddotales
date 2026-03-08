/**
 * KiddoTales type definitions
 */

export interface BookPage {
  pageNumber: number;
  text: string;
  imagePrompt?: string;
  illustrationPromptBase?: string; // from prompts.ts schema
  imageUrl?: string;
  /** Base64 data URL for persistent storage (survives Replicate URL expiry) */
  imageData?: string;
}

export interface BookData {
  id?: string;
  title: string;
  pages: BookPage[];
  createdAt: string;
  /** Cover image URL - AI-generated to encompass the whole story */
  coverImageUrl?: string;
  /** Base64 data URL for persistent storage */
  coverImageData?: string;
}

/** Optional physical appearance for character consistency in illustrations */
export interface CharacterAppearance {
  hairColor?: string;
  hairStyle?: string;
  skinTone?: string;
  eyeColor?: string;
  glasses?: boolean;
  freckles?: boolean;
}

export interface CreateFormData {
  childName: string;
  age: number;
  pronouns: string;
  interests: string[];
  lifeLesson: string;
  artStyle: string;
  /** Optional appearance overrides for the main character */
  appearance?: CharacterAppearance;
}

export const HAIR_COLORS = [
  { value: "", label: "Any" },
  { value: "blonde", label: "Blonde" },
  { value: "brown", label: "Brown" },
  { value: "black", label: "Black" },
  { value: "red", label: "Red" },
  { value: "auburn", label: "Auburn" },
] as const;

export const HAIR_STYLES = [
  { value: "", label: "Any" },
  { value: "short", label: "Short" },
  { value: "long", label: "Long" },
  { value: "curly", label: "Curly" },
  { value: "straight", label: "Straight" },
  { value: "pigtails", label: "Pigtails" },
  { value: "braids", label: "Braids" },
  { value: "ponytail", label: "Ponytail" },
] as const;

export const SKIN_TONES = [
  { value: "", label: "Any" },
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "tan", label: "Tan" },
  { value: "brown", label: "Brown" },
  { value: "dark", label: "Dark" },
] as const;

export const EYE_COLORS = [
  { value: "", label: "Any" },
  { value: "blue", label: "Blue" },
  { value: "brown", label: "Brown" },
  { value: "green", label: "Green" },
  { value: "hazel", label: "Hazel" },
] as const;

export const ART_STYLES = [
  "whimsical-watercolor",
  "pixar-3d",
  "hand-drawn-classic",
  "vibrant-cartoon",
] as const;

export type ArtStyle = (typeof ART_STYLES)[number];

export const LIFE_LESSONS = [
  "kindness",
  "bravery",
  "perseverance",
  "sharing",
  "trying-new-things",
  "friendship",
  "gratitude",
  "honesty",
] as const;

export const INTERESTS = [
  "dinosaurs",
  "space",
  "soccer",
  "ballet",
  "unicorns",
  "robots",
  "princesses",
  "superheroes",
  "ocean",
  "forest",
] as const;

export const GENDERS = [
  { value: "he/him", label: "Boy" },
  { value: "she/her", label: "Girl" },
] as const;