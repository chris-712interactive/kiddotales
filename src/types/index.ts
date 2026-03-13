/**
 * KiddoTales type definitions
 */

export interface BookPage {
  pageNumber: number;
  text: string;
  imagePrompt?: string;
  illustrationPromptBase?: string; // from prompts.ts schema
  /** True if the secondary character (from story) appears in this page's illustration */
  secondaryCharacterInScene?: boolean;
  imageUrl?: string;
  /** Base64 data URL for persistent storage (survives Replicate URL expiry) */
  imageData?: string;
  /** AI-generated audio URL for read-aloud */
  audioUrl?: string;
  /** Voice ID used when audio was generated */
  audioVoice?: string;
}

/** Optional dedication page: message from parent/guardian, shown after cover, before first story page. No illustration, no voice-over. */
export interface Dedication {
  message: string;
  from: string;
}

export interface BookData {
  id?: string;
  title: string;
  pages: BookPage[];
  createdAt: string;
  /** Optional dedication page (message + from) shown after cover, before first interior illustration */
  dedication?: Dedication;
  /** Cover image URL - AI-generated to encompass the whole story */
  coverImageUrl?: string;
  /** Base64 data URL for persistent storage */
  coverImageData?: string;
  /** Stored creation form data for correction flow */
  creationMetadata?: CreationMetadata;
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
  /** AI voice for read-aloud (Spark: default, Magic: 3 options, Legend: all) */
  preferredVoice?: string;
  /** Optional dedication: message + from, shown after cover, before first story page. No illustration, no voice-over. */
  dedication?: Dedication;
}

/** Stored with each book for correction flow */
export type CreationMetadata = CreateFormData;

export interface ChildProfile {
  id: string;
  name: string;
  age: number;
  pronouns: string;
  interests: string[];
  appearance?: CharacterAppearance;
  createdAt?: string;
  updatedAt?: string;
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
  "photo-realistic",
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