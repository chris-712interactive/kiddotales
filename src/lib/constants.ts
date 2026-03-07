/**
 * KiddoTales prompts and constants
 * System prompt for GPT-4o to generate personalized bedtime stories
 */

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
}) => {
  const artStyleDescriptions: Record<string, string> = {
    "whimsical-watercolor": "soft watercolor illustrations with dreamy, flowing colors",
    "pixar-3d": "Pixar-style 3D CGI, vibrant and expressive",
    "hand-drawn-classic": "classic hand-drawn storybook style like vintage children's books",
    "vibrant-cartoon": "bright, bold cartoon style with clean lines",
  };

  return `Create a personalized bedtime story with these details:

- Child's name: ${params.childName}
- Age: ${params.age} years old
- Pronouns: ${params.pronouns}
- Interests: ${params.interests.join(", ")}
- Life lesson to teach: ${params.lifeLesson}
- Art style for images: ${artStyleDescriptions[params.artStyle] || params.artStyle}

Generate the complete story as JSON. Remember: exactly 8 pages, each with text and a detailed imagePrompt.`;
};

export const ART_STYLE_PROMPTS: Record<string, string> = {
  "whimsical-watercolor":
    "Children's book illustration, soft watercolor style, dreamy pastel colors, gentle brushstrokes, whimsical and magical atmosphere",
  "pixar-3d":
    "Children's book illustration, Pixar-style 3D CGI, vibrant colors, expressive characters, cinematic lighting, heartwarming",
  "hand-drawn-classic":
    "Children's book illustration, classic hand-drawn style, vintage storybook aesthetic, warm colors, detailed linework",
  "vibrant-cartoon":
    "Children's book illustration, bright bold cartoon style, clean lines, saturated colors, fun and playful",
};

export const BOOK_HISTORY_KEY = "kiddotales-book-history";
export const PENDING_BOOK_KEY = "kiddotales-pending-book";
export const MAX_HISTORY_BOOKS = 5;
