"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)] dark:from-[var(--pastel-pink)] dark:via-background dark:to-[var(--pastel-mint)]">
      <header className="flex items-center justify-between px-4 py-4 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/branding/logo.svg"
            alt="KiddoTales"
            width={32}
            height={32}
            className="size-8 object-contain"
          />
          <span className="text-xl font-bold text-foreground">KiddoTales</span>
        </Link>
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 size-4" />
            Back
          </Button>
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-4 md:px-8">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">
            Last updated: March 2025
          </p>

          <section className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">1. Introduction</h2>
            <p className="text-muted-foreground">
              KiddoTales (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting children&apos;s privacy. This Privacy Policy explains how we collect, use, and protect personal information when you use our service to create personalized storybooks for your child. We comply with the Children&apos;s Online Privacy Protection Act (COPPA) and the FTC&apos;s COPPA Rule.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">2. Information We Collect</h2>
            <p className="text-muted-foreground">
              We collect the following information to create personalized storybooks:
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><strong>Child&apos;s name</strong> – used in the story</li>
              <li><strong>Child&apos;s age</strong> – for age-appropriate content</li>
              <li><strong>Child&apos;s interests</strong> – to personalize the story</li>
              <li><strong>Optional appearance details</strong> – hair color, skin tone, etc., for illustrations</li>
              <li><strong>Life lesson</strong> – the theme you choose for the story</li>
              <li><strong>Generated content</strong> – story text and AI-generated illustrations</li>
            </ul>
            <p className="text-muted-foreground">
              We also collect parent/guardian information when you sign in with Google: email address and account identifier.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">3. How We Use Information</h2>
            <p className="text-muted-foreground">
              We use the information we collect solely to:
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Create personalized storybooks for your child</li>
              <li>Store your books so you can view and download them</li>
              <li>Manage your account and subscription</li>
            </ul>
            <p className="text-muted-foreground">
              We do not use this information for advertising, marketing, or profiling.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">4. Third Parties We Share Information With</h2>
            <p className="text-muted-foreground">
              To provide our service, we share child information with:
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><strong>OpenAI</strong> – to generate story text and AI voice narration (text-to-speech). Child name, age, interests, and appearance are sent to OpenAI. See <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">OpenAI&apos;s Privacy Policy</a>.</li>
              <li><strong>Replicate</strong> – to generate story illustrations. See <a href="https://replicate.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Replicate&apos;s Terms</a>.</li>
              <li><strong>Supabase</strong> – to store your books and account data securely.</li>
              <li><strong>Google</strong> – for sign-in authentication.</li>
              <li><strong>Stripe</strong> – for subscription payments (if applicable).</li>
            </ul>
            <p className="text-muted-foreground">
              These providers process data only for the purposes we authorize and do not use it for their own advertising or profiling.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">5. Data Retention</h2>
            <p className="text-muted-foreground">
              You may request deletion of your child&apos;s data at any time (see Parent Rights below). That is our primary retention mechanism. In addition, we automatically remove data according to the following rules:
            </p>

            <h3 className="mt-4 text-lg font-medium text-foreground">5.1 Delete on Request</h3>
            <p className="text-muted-foreground">
              You can delete individual books or all your books at any time from <Link href="/settings/books" className="underline hover:text-foreground">Manage books</Link>. We process deletion requests promptly and remove data from our systems and storage.
            </p>

            <h3 className="mt-4 text-lg font-medium text-foreground">5.2 Free Tier Retention</h3>
            <p className="text-muted-foreground">
              If you are on the free tier, we may automatically delete your books when <strong>both</strong> of the following are true:
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>You have not logged in for more than 30 consecutive days (&quot;inactive&quot; means no login to your account)</li>
              <li>The books are older than 3 months from their creation date</li>
            </ul>
            <p className="text-muted-foreground">
              We also remove individual books on the free tier if a book has not been opened for 90 consecutive days. We show warnings in <Link href="/settings/books" className="underline hover:text-foreground">Manage books</Link> and in your notifications when a book has not been opened in over 30 days, so you can open it to keep it.
            </p>

            <h3 className="mt-4 text-lg font-medium text-foreground">5.3 Paid Tier Retention</h3>
            <p className="text-muted-foreground">
              If you have an active paid subscription (Spark, Magic, or Legend), we retain your books for as long as your subscription is active. The per-book 90-day inactivity rule does not apply to paid tiers.
            </p>

            <h3 className="mt-4 text-lg font-medium text-foreground">5.4 Downgrade from Paid to Free</h3>
            <p className="text-muted-foreground">
              When your paid subscription ends and you return to the free tier, the free tier retention rules apply from that date. Books may be removed according to the free tier rules above.
            </p>

            <h3 className="mt-4 text-lg font-medium text-foreground">5.5 Backup and Legal Hold</h3>
            <p className="text-muted-foreground">
              After you request deletion or after automatic removal, we may retain data for up to 12 months in backup systems for legal and operational purposes, after which it is permanently removed.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">6. Parent Rights</h2>
            <p className="text-muted-foreground">
              As a parent or guardian, you have the right to:
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><strong>Access</strong> – View the personal information we have collected about your child</li>
              <li><strong>Correct</strong> – Request correction of inaccurate information (you can delete a book and create a new one with corrected details)</li>
              <li><strong>Delete</strong> – Request deletion of all your child&apos;s data and books at any time</li>
              <li><strong>Revoke consent</strong> – Withdraw consent and stop future collection</li>
            </ul>
            <p className="text-muted-foreground">
              To exercise these rights, go to <Link href="/settings" className="underline hover:text-foreground">Account settings</Link> and use the &quot;Manage child data&quot; section. You may also contact us at the email below.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">7. Security</h2>
            <p className="text-muted-foreground">
              We use industry-standard security measures including encryption in transit (HTTPS) and at rest. Access to child data is restricted to authorized personnel and systems necessary to provide the service.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">8. Contact Us</h2>
            <p className="text-muted-foreground">
              For privacy questions or to exercise your rights, contact us at:{" "}
              <a href="mailto:privacy@712int.com" className="underline hover:text-foreground">privacy@712int.com</a>
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
