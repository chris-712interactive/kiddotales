import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpen,
  Check,
  Crown,
  FileText,
  Heart,
  MessageCircleHeart,
  Mic,
  ShieldCheck,
  Sparkles,
  Star,
  Volume2,
  Wand2,
  Zap,
} from "lucide-react";
import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { LandingThemeLock } from "@/components/landing/landing-theme-lock";
import { Button } from "@/components/ui/button";
import { SUBSCRIPTION_TIERS } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "KiddoTales for Instagram | Personalized Bedtime Stories",
  description:
    "Create personalized bedtime stories with illustrations, optional AI voice, and print-ready PDFs. Start free, then upgrade for more.",
};

const SOCIAL_PROOF = [
  {
    quote: "My daughter asks for her KiddoTales story every single night.",
    author: "Parent of a 5-year-old",
  },
  {
    quote: "We printed two books for grandparents and they loved them.",
    author: "Family plan subscriber",
  },
  {
    quote: "The life-lesson prompts are perfect for calm bedtime conversations.",
    author: "Parent of twins",
  },
];

const FEATURES = [
  {
    title: "Personalized for your child",
    body: "Name, age, interests, and life lessons become a unique story experience.",
    icon: Sparkles,
  },
  {
    title: "Beautiful illustrations",
    body: "Choose from multiple art styles to match your child's imagination.",
    icon: Wand2,
  },
  {
    title: "Optional AI read-aloud",
    body: "Supported plans include AI voices so stories can be read aloud automatically.",
    icon: Volume2,
  },
  {
    title: "Print-ready PDFs",
    body: "Download your stories for keepsakes, gifts, and bedtime shelf collections.",
    icon: FileText,
  },
  {
    title: "Profile-based creation",
    body: "Save child profiles to generate future stories in seconds.",
    icon: Heart,
  },
  {
    title: "Built for families",
    body: "Upgrade for more books, more voice usage, and multi-child support.",
    icon: Crown,
  },
];

export default async function InstagramLandingPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/create");
  }

  const signInHref = "/sign-in?callbackUrl=%2Fpricing%3Fsource%3Dinstagram";
  const pricingHref = "/pricing?source=instagram";
  const createHref = "/create?source=instagram";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)]">
      <LandingThemeLock />
      <AppHeader className="shrink-0" />

      <main className="instagramLandingPage mx-auto min-h-0 w-full max-w-6xl flex-1 touch-pan-y overflow-y-auto overscroll-y-contain pb-[max(1rem,env(safe-area-inset-bottom,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-8 [-webkit-overflow-scrolling:touch] md:pl-8 md:pr-8">
        <section className="rounded-3xl border-2 border-border bg-card p-6 shadow-xl md:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 flex justify-center">
              <div className="logoFromInstagramContainer">
                <Image
                  src="/branding/logoCircle.svg"
                  alt="KiddoTales logo"
                  width={200}
                  height={200}
                  className="rounded-xl object-contain"
                  priority
                />
              </div>
            </div>
            <div className="instagramGradientBackground mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Star className="size-4" />
              KiddoTales for Instagram families
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl">
              Turn bedtime into your child&apos;s favorite part of the day
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
              Personalized storybooks in minutes with illustrations, optional AI voice, and
              print-ready PDFs. Start free, then upgrade when you want more stories each month.
            </p>
            <div className="mt-7 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Link href={signInHref} className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto sm:min-w-[200px]">
                  <MessageCircleHeart className="mr-2 size-5" />
                  Sign In to Get Started
                </Button>
              </Link>
              <Link href={pricingHref} className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto sm:min-w-[200px]">
                  View Plans & Pricing
                </Button>
              </Link>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              New to KiddoTales? You can start with the Free plan first.
            </p>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-center text-2xl font-bold text-foreground md:text-3xl">
            Everything KiddoTales offers
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
            Built for busy parents who want magical stories, meaningful moments, and easy bedtime
            routines.
          </p>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="mb-3 inline-flex items-center gap-2 text-primary">
                  <feature.icon className="size-5" />
                  <span className="font-semibold">{feature.title}</span>
                </div>
                <p className="text-sm text-muted-foreground">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 size-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold text-foreground">COPPA parental consent flow</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                We include parental consent steps before creating personalized stories.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mic className="mt-1 size-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold text-foreground">Voice + print flexibility</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Listen at bedtime, print for keepsakes, or do both.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Zap className="mt-1 size-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold text-foreground">Fast story generation</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Generate in minutes, then save profiles to make future books even faster.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-center text-2xl font-bold text-foreground md:text-3xl">
            Plans built for every family stage
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
            Start free, then upgrade when you want more books, AI voice usage, and premium tools.
          </p>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(Object.keys(SUBSCRIPTION_TIERS) as Array<keyof typeof SUBSCRIPTION_TIERS>).map(
              (tierKey) => {
                const tier = SUBSCRIPTION_TIERS[tierKey];
                const highlighted = tierKey === "magic" || tierKey === "legend";
                return (
                  <div
                    key={tier.id}
                    className={[
                      "flex h-full flex-col rounded-2xl border p-5 shadow-sm tierCard",
                      highlighted ? "border-primary/40 bg-primary/5" : "border-border bg-card", 
                      tierKey === "magic" && "instagramGradientBackground"
                    ].join(" ")}
                  >
                    <div className="tierCardContentTop">
                      <div className="mb-2 flex items-center justify-between gap-2 tierCardHeader">
                        <div className="flex items-center gap-2">
                          {tierKey === "free" && <Sparkles className="size-4 text-primary" />}
                          {tierKey === "spark" && <Zap className="size-4 text-primary" />}
                          {tierKey === "magic" && <Wand2 className="size-4 text-primary" />}
                          {tierKey === "legend" && <Crown className="size-4 text-primary" />}
                          <span className="font-semibold text-foreground">{tier.name}</span>
                        </div>
                        {tierKey === "magic" && (
                          <span className="rounded-full bg-primary/20 px-2 py-1 text-xs font-medium text-primary">
                            Popular
                          </span>
                        )}
                      </div>
                      <p className="text-2xl font-bold text-foreground tierCardPrice">
                        {tier.priceMonthly == null ? "Free" : `$${tier.priceMonthly}/mo`}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground tierCardBookLimit">
                        {tier.bookLimit} books{" "}
                        {tier.bookLimitPeriod === "monthly" ? "per month" : "total"}
                      </p>
                      <ul className="mt-4 space-y-2 tierCardFeatures">
                        {tier.features.slice(0, 5).map((feature) => (
                          <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-5 tierCardContentBottom">
                      <Link href={pricingHref}>
                        <Button className="w-full tierCardButton" variant={tierKey === "free" ? "outline" : "default"}>
                          Choose {tier.name}
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-center text-2xl font-bold text-foreground md:text-3xl">
            Loved by parents
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SOCIAL_PROOF.map((item) => (
              <div key={item.author} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <p className="text-sm text-muted-foreground">&ldquo;{item.quote}&rdquo;</p>
                <p className="mt-3 text-sm font-medium text-foreground">— {item.author}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-3xl border-2 border-primary/30 bg-card p-6 text-center shadow-lg sm:p-8">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Ready to start your first story?</h2>
          <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
            Sign in to begin creating your child&apos;s personalized bedtime book, then pick the
            plan that matches your family.
          </p>
          <div className="mt-6 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
            <Link href={signInHref} className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto sm:min-w-[180px]">
                <BookOpen className="mr-2 size-5" />
                Sign In & Start
              </Button>
            </Link>
            <Link href={pricingHref} className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto sm:min-w-[180px]">
                Compare All Plans
              </Button>
            </Link>
            <Link href={createHref} className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto sm:min-w-[180px]">
                Preview Creation Flow
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
