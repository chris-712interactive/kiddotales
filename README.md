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
- **Book History** – Last 5 books (IndexedDB); when signed in, books sync to Supabase for cross-device access
- **Auth** – Sign in with Google (NextAuth.js)
- **Book Limits** – Configurable limit per user when Supabase is configured

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS v4
- Framer Motion
- OpenAI GPT-4o (story generation)
- Replicate Flux Schnell (image generation)
- @react-pdf/renderer (PDF export)
- Sonner (toasts)
- NextAuth.js v5 (Google auth)
- Supabase (Postgres + Storage for book limits and cross-device sync)

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
   - `AUTH_SECRET` – Generate with `openssl rand -base64 32`
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` – [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` – [Supabase](https://supabase.com) (for book limits and cross-device sync)

3. **Supabase setup** (optional but recommended)
   - Create a project at [supabase.com](https://supabase.com)
   - Run the migration in `supabase/migrations/001_initial_schema.sql` via Supabase SQL Editor
   - Create a Storage bucket named `book-images` with public read access

4. **Run development server**
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

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

## COPPA Compliance

KiddoTales collects children's personal information (name, age, interests, etc.) and must comply with COPPA. See **[COPPA_COMPLIANCE.md](./COPPA_COMPLIANCE.md)** for required measures and implementation checklist.

## License

MIT
