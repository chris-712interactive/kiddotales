/**
 * KiddoTales type definitions
 */

export interface BookPage {
  pageNumber: number;
  text: string;
  imagePrompt?: string;
  illustrationPromptBase?: string; // from prompts.ts schema
  imageUrl?: string;
}

export interface BookData {
  title: string;
  pages: BookPage[];
  createdAt: string;
}

export interface CreateFormData {
  childName: string;
  age: number;
  pronouns: string;
  interests: string[];
  lifeLesson: string;
  artStyle: string;
}

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

export const PRONOUNS = [
  { value: "he/him", label: "he/him" },
  { value: "she/her", label: "she/her" },
  { value: "they/them", label: "they/them" },
  { value: "custom", label: "Custom" },
] as const;
