"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)] dark:from-[var(--pastel-pink)] dark:via-background dark:to-[var(--pastel-mint)]">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2">
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
          <Button variant="ghost" size="sm" className="size-9 px-2 sm:size-auto sm:px-3" aria-label="Back">
            <ArrowLeft className="size-4 sm:mr-1" />
            <span className="hidden sm:inline">Back</span>
          </Button>
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-4 md:px-8">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">
            Last updated: March 2025
          </p>

          <section className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing or using KiddoTales (&quot;Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. The Service is intended for parents and guardians creating personalized storybooks for children. You must be at least 18 years old and the parent or legal guardian of the child for whom you create content.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">2. Description of Service</h2>
            <p className="text-muted-foreground">
              KiddoTales allows you to create personalized AI-generated storybooks featuring your child. The Service includes story generation, AI illustrations, optional AI voice narration, PDF export, and cloud storage of your books. Features and limits vary by subscription tier.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">3. Account and Eligibility</h2>
            <p className="text-muted-foreground">
              You must sign in with Google to create books. You are responsible for maintaining the confidentiality of your account. You represent that you are a parent or legal guardian and have the authority to provide child information for the purposes described in our{" "}
              <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">4. Acceptable Use</h2>
            <p className="text-muted-foreground">
              You agree not to:
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Use the Service for any illegal purpose or in violation of any laws</li>
              <li>Submit false, misleading, or inappropriate content</li>
              <li>Attempt to circumvent usage limits, security measures, or access controls</li>
              <li>Resell, redistribute, or commercially exploit the Service without permission</li>
              <li>Use the Service to harm minors or collect information from children without parental consent</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              We reserve the right to suspend or terminate accounts that violate these terms.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">5. Subscriptions and Payments</h2>
            <p className="text-muted-foreground">
              Paid subscriptions (Spark, Magic, Legend) are billed monthly or annually through Stripe. By subscribing, you authorize recurring charges. You may cancel at any time from your account settings; cancellation takes effect at the end of the current billing period. Refunds are handled per our refund policy and applicable law. We may change pricing with reasonable notice; continued use after a price change constitutes acceptance.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">6. Intellectual Property</h2>
            <p className="text-muted-foreground">
              You retain ownership of the personal information you provide. Generated story content and illustrations are created for your personal, non-commercial use. KiddoTales and its branding, technology, and underlying systems remain our property. Commercial use of generated content may require a separate agreement.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">7. Disclaimers</h2>
            <p className="text-muted-foreground">
              The Service is provided &quot;as is&quot; without warranties of any kind. We do not guarantee that the Service will be uninterrupted, error-free, or that generated content will meet your expectations. AI-generated content may contain inaccuracies or unexpected results. You use the Service at your own risk.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">8. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              To the maximum extent permitted by law, KiddoTales and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, data, or goodwill, arising from your use of the Service. Our total liability shall not exceed the amount you paid us in the twelve months preceding the claim.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">9. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We may update these Terms from time to time. We will notify you of material changes by posting the updated Terms and updating the &quot;Last updated&quot; date. Continued use of the Service after changes constitutes acceptance. If you do not agree, you must stop using the Service.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">10. Contact</h2>
            <p className="text-muted-foreground">
              For questions about these Terms, contact us at:{" "}
              <a href="mailto:privacy@712int.com" className="underline hover:text-foreground">privacy@712int.com</a>
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
