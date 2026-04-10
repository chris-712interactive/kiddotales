"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/app-header";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)] dark:from-[var(--pastel-pink)] dark:via-background dark:to-[var(--pastel-mint)]">
      <AppHeader
        pageActions={
          <Link href="/">
            <Button variant="ghost" size="sm" className="size-9 px-2 sm:size-auto sm:px-3" aria-label="Back">
              <ArrowLeft className="size-4 sm:mr-1" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          </Link>
        }
      />

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-4 md:px-8">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">
            Last updated: April 2026
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
              <li>Commercialize the KiddoTales platform itself (for example reselling access, white-labeling, or scraping the Service) without our written permission</li>
              <li>Use storybooks, illustrations, or other output generated through the Service for commercial purposes when your subscription tier does not allow commercial use (see Intellectual Property below)</li>
              <li>Use the Service to harm minors or collect information from children without parental consent</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              We reserve the right to suspend or terminate accounts that violate these terms.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">5. Subscriptions and Payments</h2>
            <p className="text-muted-foreground">
              Paid subscriptions (Spark, Magic, Legend) are billed monthly or annually through Stripe. By subscribing, you authorize recurring charges. You may cancel at any time from your account settings; cancellation takes effect at the end of the current billing period. Refunds are handled per our refund policy and applicable law. We may change pricing with reasonable notice; continued use after a price change constitutes acceptance. Which activities you may perform with downloaded or exported books—including whether commercial use is permitted—depends on your active plan as described in the Intellectual Property section.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">6. Intellectual Property and use of generated content</h2>
            <p className="text-muted-foreground">
              You retain ownership of the personal information you provide about your child and family. Stories, illustrations, audio, and other materials produced by the Service for your account (&quot;Output&quot;) are provided for your use subject to this section and your subscription tier. KiddoTales and its branding, software, models, prompts, and underlying systems remain our property.
            </p>
            <h3 className="text-lg font-semibold text-foreground">6.1 Personal and commercial use by plan</h3>
            <p className="text-muted-foreground">
              <strong className="text-foreground">Free, Spark, and Magic.</strong> Output is licensed for your <strong className="text-foreground">personal, non-commercial</strong> use only. That includes reading and sharing with family and friends in a private, non-commercial context. You may not sell, license for a fee, use in paid advertising, or otherwise exploit Output for commercial purposes unless you upgrade to a plan that expressly allows commercial use. PDFs or other exports may include a notice reminding you of this restriction.
            </p>
            <p className="text-muted-foreground">
              <strong className="text-foreground">Legend.</strong> If you have an active Legend subscription (or equivalent access we designate), Output is licensed for both <strong className="text-foreground">personal and commercial</strong> use. Examples include selling printed copies you produce, using illustrations in your own small business materials, or offering books you created as part of a permitted service—always subject to these Terms, our Acceptable Use rules, and your responsibility for any third-party rights (for example likeness, trademarks, or other people&apos;s content you asked us to incorporate).
            </p>
            <p className="text-muted-foreground">
              <strong className="text-foreground">Family sharing.</strong> If you access the Service through a household Legend plan as an invited family member, your rights to Output you create follow the <strong className="text-foreground">subscriber&apos;s</strong> plan (Legend commercial terms apply to your generated books while that sharing remains active). The paying subscriber remains responsible for the subscription and billing.
            </p>
            <p className="text-muted-foreground">
              <strong className="text-foreground">After downgrade or cancellation.</strong> If you move from Legend to a tier that does not include commercial use, you must stop new commercial exploitation of Output created after the change under the prior tier; we do not grant retroactive commercial rights for books you create on a non-commercial plan. Reasonable ongoing personal use of books you already made generally remains acceptable.
            </p>
            <p className="text-muted-foreground">
              Nothing in this section allows you to misrepresent KiddoTales as endorsing your product, to remove required legal notices we place on exports where applicable, or to use the Service or our trademarks in a way that suggests you operate or own KiddoTales.
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
