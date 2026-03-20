"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Calendar,
  Check,
  Crown,
  FileText,
  HeartHandshake,
  PenLine,
  Sparkles,
  Zap,
  ShieldCheck,
  Volume2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUBSCRIPTION_TIERS, type SubscriptionTierId } from "@/lib/stripe";

const ArtDemo = dynamic(() => import("./UnauthenticatedLandingArtDemo"), {
  ssr: false,
  loading: () => (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/20 p-6">
      <div className="h-28 w-full animate-pulse rounded-xl bg-muted" />
    </div>
  ),
});

type PreviewMode = "text" | "illustrations" | "pdf" | "voice";

const TESTIMONIALS = [
  {
    quote: "My 4-year-old asks for 'her' story every night now. Pure magic!",
    author: "Sarah M.",
    emoji: "✨",
  },
  {
    quote: "Finally, bedtime stories that feature MY kid. Game changer.",
    author: "David L.",
    emoji: "🌟",
  },
  {
    quote: "The illustrations are gorgeous. We printed ours and it's on the shelf!",
    author: "Emma K.",
    emoji: "📚",
  },
];

const faqItems = [
  {
    id: "faq-how-fast",
    q: "How fast are stories generated?",
    a: "Most stories are ready in minutes, depending on the details you enter and your plan level.",
  },
  {
    id: "faq-upload",
    q: "Do I need to upload anything?",
    a: "No uploads are required for the basic experience. Optional: you can replace your W-9 on your affiliate dashboard, and you can download PDFs after creation.",
  },
  {
    id: "faq-coppa",
    q: "Is KiddoTales COPPA-ready?",
    a: "We use a parental consent flow before creating personalized books, and we follow the COPPA requirements for children’s privacy.",
  },
  {
    id: "faq-edit",
    q: "Can I edit or regenerate pages?",
    a: "Yes. Depending on your plan, you can regenerate pages to get the look you want and keep tweaking your story.",
  },
  {
    id: "faq-voice",
    q: "Does it read aloud?",
    a: "You can optionally enable AI voice read-aloud for supported plans. You’ll choose the voice during creation and can listen as the story plays.",
  },
  {
    id: "faq-pdf",
    q: "Can I download a print-ready PDF?",
    a: "Yes. Download your storybook as a PDF designed for easy printing. Higher tiers include premium PDF layouts.",
  },
  {
    id: "faq-storage",
    q: "Where do my books live?",
    a: "Your books are stored securely so you can download and revisit them anytime.",
  },
];

function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, delay }}
    >
      {children}
    </motion.div>
  );
}

function FAQAccordion() {
  const [openId, setOpenId] = useState<string | null>(faqItems[0]?.id ?? null);

  return (
    <div className="mx-auto grid gap-5 md:grid-cols-2">
      {faqItems.map((item, idx) => {
        const open = openId === item.id;
        return (
          <div
            key={item.id}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <button
              type="button"
              className="flex w-full items-start justify-between gap-3 text-left"
              onClick={() => setOpenId(open ? null : item.id)}
              aria-expanded={open}
            >
              <span className="text-sm font-semibold text-foreground">
                {item.q}
              </span>
              <span className="mt-0.5 text-muted-foreground">{open ? "—" : "+"}</span>
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  key={`${item.id}-${open ? "open" : "closed"}`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            {idx === 0 && <span className="sr-only">FAQ</span>}
          </div>
        );
      })}
    </div>
  );
}

function TierPriceTeaser({
  tierId,
}: {
  tierId: SubscriptionTierId;
}) {
  const tier = SUBSCRIPTION_TIERS[tierId];
  return (
    <div className="mt-2">
      {tierId === "free" ? (
        <div className="text-3xl font-bold">Free</div>
      ) : (
        <div className="text-3xl font-bold">
          ${tier.priceMonthly}
          <span className="text-base font-normal text-muted-foreground">/mo</span>
        </div>
      )}
    </div>
  );
}

function PlanTeaser() {
  const tierOrder: SubscriptionTierId[] = ["free", "spark", "magic", "legend"];

  const sellingPoints: Array<{
    id: string;
    label: string;
    check: (tierId: SubscriptionTierId) => boolean;
    icon: React.ReactNode;
  }> = [
    {
      id: "sp-ai-voice",
      label: "Optional AI voice read-aloud",
      check: (tierId) => tierId !== "free",
      icon: <Volume2 className="size-4" />,
    },
    {
      id: "sp-premium-pdf",
      label: "Premium PDF layouts",
      check: (tierId) => tierId === "magic" || tierId === "legend",
      icon: <FileText className="size-4" />,
    },
    {
      id: "sp-edit-regenerate",
      label: "Edit & regenerate pages",
      check: (tierId) => tierId !== "free",
      icon: <PenLine className="size-4" />,
    },
    {
      id: "sp-family",
      label: "Multi-child profiles & sharing",
      check: (tierId) => tierId === "legend",
      icon: <HeartHandshake className="size-4" />,
    },
    {
      id: "sp-priority",
      label: "Priority generation",
      check: (tierId) => tierId === "magic" || tierId === "legend",
      icon: <Zap className="size-4" />,
    },
  ];

  return (
    <section className="mt-14">
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Find the right plan for your family
            </h2>
            <p className="mt-2 text-muted-foreground">
              Features update as you upgrade—no surprises.
            </p>
          </div>
          <Link href="/pricing">
            <Button variant="outline">Compare full plans</Button>
          </Link>
        </div>
      </Reveal>

      <div className="mt-8 grid gap-6 lg:grid-cols-4">
        {tierOrder.map((tierId, idx) => {
          const tier = SUBSCRIPTION_TIERS[tierId];
          const isLegend = tierId === "legend";
          const isMagic = tierId === "magic";

          const highlighted = isLegend || isMagic;
          return (
            <Reveal key={tierId} delay={idx * 0.06}>
              <div
                className={[
                  "relative flex h-full flex-col rounded-2xl border p-6 shadow-sm",
                  highlighted ? "border-primary/50 bg-primary/5" : "border-border bg-card",
                ].join(" ")}
              >
                {tierId === "legend" && (
                  <div className="absolute right-4 top-4 rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary">
                    Best for families
                  </div>
                )}
                {tierId === "magic" && (
                  <div className="absolute right-4 top-4 rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary">
                    Popular pick
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  {tierId === "free" ? (
                    <Sparkles className="size-5" />
                  ) : tierId === "spark" ? (
                    <Zap className="size-5" />
                  ) : tierId === "magic" ? (
                    <Wand2 className="size-5" />
                  ) : (
                    <Crown className="size-5" />
                  )}
                  <span className="font-semibold">{tier.name}</span>
                </div>

                <TierPriceTeaser tierId={tierId} />

                <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                  {sellingPoints.map((sp) => {
                    const ok = sp.check(tierId);
                    return (
                      <li key={sp.id} className="flex items-start gap-2">
                        <span className={ok ? "text-primary" : "text-muted-foreground"}>
                          {ok ? <Check className="size-4" /> : <span className="inline-block size-4" />}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <span className={ok ? "text-primary" : "text-muted-foreground"}>{sp.icon}</span>
                          {sp.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-6">
                  <Link href="/create">
                    <Button className="w-full" variant={tierId === "free" ? "outline" : "default"}>
                      {tierId === "free" ? "Start free" : "Start now"}
                    </Button>
                  </Link>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

export default function UnauthenticatedLanding() {
  const [previewMode, setPreviewMode] = useState<PreviewMode>("illustrations");

  // Structured data: helps search engines understand the content and FAQs.
  const faqSchema = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_APP_URL;
    const rootUrl = base ? new URL("/", base).toString() : "/";

    const faqPage = {
      "@type": "FAQPage",
      url: rootUrl,
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      })),
    };

    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          name: "KiddoTales",
          url: rootUrl,
          logo: `${rootUrl}branding/logo.svg`,
        },
        {
          "@type": "WebSite",
          name: "KiddoTales",
          url: rootUrl,
        },
        faqPage,
      ],
    };
  }, []);

  const heroCopy = useMemo(() => {
    switch (previewMode) {
      case "text":
        return {
          title: "Personalized story text",
          body: "Your child’s name, age, and favorite things become a bedtime story that feels made just for them.",
          icon: <BookOpen className="size-5 text-primary" />,
        };
      case "illustrations":
        return {
          title: "Kid-friendly illustrations",
          body: "Beautiful artwork that matches the vibe of the story—so bedtime stays magical.",
          icon: <Sparkles className="size-5 text-primary" />,
        };
      case "pdf":
        return {
          title: "Downloadable, print-ready PDFs",
          body: "Keep a copy for nights you want to relive, with layouts designed for easy printing.",
          icon: <FileText className="size-5 text-primary" />,
        };
      case "voice":
        return {
          title: "Optional read-aloud (AI voice)",
          body: "Add voice narration for supported plans and listen to the story out loud.",
          icon: <Volume2 className="size-5 text-primary" />,
        };
    }
  }, [previewMode]);

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Hero */}
      <section className="flex flex-col items-center text-center">
        <motion.div
          className="mb-6 flex items-center justify-center gap-4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Sparkles className="size-12 text-yellow-500" />
          <div className="rounded-2xl bg-primary/20 p-6 shadow-xl">
            <BookOpen className="size-24" />
          </div>
          <Sparkles className="size-12 text-yellow-500" />
        </motion.div>

        <motion.h1
          className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
        >
          Turn 60 seconds into{" "}
          <span className="text-primary">bedtime magic</span>
        </motion.h1>

        <motion.p
          className="mx-auto mb-4 max-w-2xl text-lg text-muted-foreground md:text-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          Create personalized storybooks starring your child. Fill in a few
          details, and we’ll generate a unique tale with beautiful illustrations—ready in minutes.
        </motion.p>

        <motion.div
          className="mx-auto mb-8 flex max-w-2xl flex-col items-center gap-3 sm:flex-row sm:justify-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
        >
          <Link href="/create">
            <Button size="lg" className="text-lg">
              <BookOpen className="mr-2 size-5" />
              Create your first book
            </Button>
          </Link>
          <Link
            href="/pricing"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            View plans & pricing
          </Link>
        </motion.div>

        <Reveal delay={0.05}>
          <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm">
              <ShieldCheck className="size-4 text-primary" />
              COPPA parental consent flow
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm">
              <Calendar className="size-4 text-primary" />
              Ready in minutes
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm">
              <Sparkles className="size-4 text-primary" />
              Premium illustrations
            </div>
          </div>
        </Reveal>

        {/* Hero preview */}
        <Reveal>
          <div className="w-full max-w-6xl">
            <div className="rounded-3xl border border-border bg-card/60 p-6 shadow-sm backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="size-4 text-primary" />
                  Preview what you’ll get
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      ["illustrations", "Illustrations"],
                      ["text", "Story"],
                      ["pdf", "PDF"],
                      ["voice", "Read-aloud"],
                    ] as Array<[PreviewMode, string]>
                  ).map(([id, label]) => (
                    <Button
                      key={id}
                      type="button"
                      variant={previewMode === id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPreviewMode(id)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-6 md:grid-cols-2 md:items-center">
                <div className="px-3">
                  <div className="flex items-start gap-2">
                    {heroCopy.icon}
                    <h2 className="text-lg font-bold text-foreground">
                      {heroCopy.title}
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground text-left">
                    {heroCopy.body}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                      <Check className="size-4 text-primary" />
                      Personalized to your child
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                      <Check className="size-4 text-primary" />
                      Built for bedtime
                    </div>
                  </div>
                </div>
                <div className="px-3">
                  <ArtDemo previewMode={previewMode} />
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Why */}
      <section className="mt-14">
        <Reveal>
          <h2 className="text-center text-2xl font-bold text-foreground">
            Everything you need for magical bedtime
          </h2>
          <p className="mt-2 text-center text-muted-foreground">
            KiddoTales combines personalization, beautiful art, and print-ready outputs in one simple flow.
          </p>
        </Reveal>

        <div className="mt-8 grid gap-6 md:grid-cols-4">
          <Reveal delay={0.02}>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="size-5" />
                <div className="text-sm font-semibold">Personalized</div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Stories that include your child’s details—so it feels real.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.06}>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 text-primary">
                <Wand2 className="size-5" />
                <div className="text-sm font-semibold">Beautiful art</div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Illustration styles that make the story come alive.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 text-primary">
                <Volume2 className="size-5" />
                <div className="text-sm font-semibold">Optional read-aloud</div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Add narration for supported plans and listen together.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.14}>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 text-primary">
                <FileText className="size-5" />
                <div className="text-sm font-semibold">Print-ready PDFs</div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Download your book and make it shelf-worthy.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section className="mt-14">
        <Reveal>
          <h2 className="text-2xl font-bold text-foreground">
            How it works
          </h2>
          <p className="mt-2 text-muted-foreground">
            A simple 3-step flow—built for parents.
          </p>
        </Reveal>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            {
              num: "1",
              title: "Add your child’s details",
              body: "Choose a profile (or create one), and tell us the basics of the story.",
              icon: <Sparkles className="size-5 text-primary" />,
            },
            {
              num: "2",
              title: "Generate story + illustrations",
              body: "We turn your input into a unique bedtime book with beautiful artwork.",
              icon: <Zap className="size-5 text-primary" />,
            },
            {
              num: "3",
              title: "Read aloud and download",
              body: "Enjoy read-aloud (optional) and download a print-ready PDF anytime.",
              icon: <FileText className="size-5 text-primary" />,
            },
          ].map((step, idx) => (
            <Reveal key={step.num} delay={idx * 0.06}>
              <div className="relative rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary font-bold">
                    {step.num}
                  </div>
                  {step.icon}
                  <h3 className="text-base font-semibold text-foreground">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {step.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Plan teaser */}
      <PlanTeaser />

      {/* Testimonials */}
      <section className="mt-14">
        <Reveal>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">
              Parents love it
            </h2>
            <p className="mt-2 text-muted-foreground">
              Real feedback from families using KiddoTales.
            </p>
          </div>
        </Reveal>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, idx) => (
            <Reveal key={t.author} delay={idx * 0.06}>
              <div className="rounded-2xl border-2 border-border bg-card p-6 shadow-lg">
                <p className="mb-4 text-muted-foreground">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-medium">— {t.author}</span>
                  <span className="text-2xl">{t.emoji}</span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-14">
        <Reveal>
          <h2 className="text-2xl font-bold text-foreground">
            Frequently asked questions
          </h2>
          <p className="mt-2 text-muted-foreground">
            Quick answers for busy parents.
          </p>
        </Reveal>

        <div className="mt-8">
          <FAQAccordion />
        </div>
      </section>

      {/* Final CTA */}
      <section className="mt-16">
        <Reveal>
          <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
            <h2 className="text-3xl font-bold text-foreground">
              Create your first book in minutes
            </h2>
            <p className="mt-2 text-muted-foreground">
              Try it today—personalized bedtime magic is one step away.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/create">
                <Button size="lg">
                  <BookOpen className="mr-2 size-5" />
                  Create your first book
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="outline" size="lg">
                  View plans & pricing
                </Button>
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

