# KiddoTales 📚✨

**Turn 60 seconds into bedtime magic.** Create personalized AI-powered storybooks for your child with custom illustrations.

## Features

- **Personalized Stories** – Stories starring your child, with their name, interests, and chosen life lessons
- **Beautiful Illustrations** – 8 unique AI-generated images per book (Replicate Flux Schnell)
- **Read Aloud** – Browser Speech Synthesis for each page
- **Download PDF** – One-click export as a printable storybook
- **Dark/Light Mode** – Pastel kid-friendly theme
- **Voice Input** – Speak your child's name via Web Speech API
- **Surprise Me** – Random example to fill the form
- **Book History** – Last 5 books saved in localStorage

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS v4
- Framer Motion
- OpenAI GPT-4o (story generation)
- Replicate Flux Schnell (image generation)
- @react-pdf/renderer (PDF export)
- Sonner (toasts)

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```
   Add your API keys:
   - `OPENAI_API_KEY` – [OpenAI API Keys](https://platform.openai.com/api-keys)
   - `REPLICATE_API_TOKEN` – [Replicate Account](https://replicate.com/account/api-tokens)

3. **Run development server**
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── page.tsx          # Landing page
│   ├── create/page.tsx    # Create form
│   ├── book/page.tsx      # Book viewer
│   └── api/generate/      # Story + image generation API
├── components/
│   ├── ui/                # Button, Input, Card, etc.
│   ├── loading-screen.tsx
│   ├── book-pdf.tsx       # PDF generation
│   └── theme-*.tsx
├── lib/
│   ├── utils.ts
│   ├── constants.ts       # Prompts
│   └── storage.ts         # Book history
└── types/
    └── index.ts
```

## Pages

- **/** – Hero, testimonials, recent books
- **/create** – Form: name, age, pronouns, interests, life lesson, art style
- **/book** – Flip-book viewer with read aloud and PDF download

## License

MIT
