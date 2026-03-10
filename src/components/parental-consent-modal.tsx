"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  onConsent: () => Promise<void>;
  onDismiss?: () => void;
};

export function ParentalConsentModal({ onConsent, onDismiss }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) return;
    setLoading(true);
    try {
      await onConsent();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-lg"
        >
          <Card className="border-2 shadow-xl">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2">
                <Shield className="size-6 text-primary" />
                <CardTitle className="text-xl">Parental Consent Required</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                KiddoTales collects children&apos;s personal information. Under COPPA, we need your consent before creating personalized stories.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-lg border-2 border-border bg-muted/30 p-4 text-sm">
                  <p className="mb-2 font-medium">What we collect:</p>
                  <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                    <li>Your child&apos;s name, age, interests, and optional appearance details</li>
                    <li>Story content and AI-generated illustrations featuring your child</li>
                  </ul>
                  <p className="mt-2 font-medium">How we use it:</p>
                  <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                    <li>To create personalized storybooks for your child</li>
                    <li>Stored securely for you to view and download</li>
                  </ul>
                  <p className="mt-2 font-medium">Who receives it:</p>
                  <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                    <li><strong>OpenAI</strong> – story generation and AI voice narration (per their privacy policy)</li>
                    <li><strong>Replicate</strong> – image generation (per their terms)</li>
                    <li><strong>Supabase</strong> – secure storage</li>
                  </ul>
                  <p className="mt-2 text-muted-foreground">
                    We do not use this data for advertising. You can access, correct, delete, or revoke consent anytime in{" "}
                    <Link href="/settings" className="underline hover:text-foreground">Account settings</Link>.
                  </p>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border-2 border-border p-4 transition-colors hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-1 rounded border-2"
                  />
                  <span className="text-sm">
                    I am the parent or legal guardian. I have read the{" "}
                    <Link href="/privacy" className="underline hover:text-foreground" target="_blank" rel="noopener noreferrer">
                      Privacy Policy
                      <ExternalLink className="ml-0.5 inline size-3" />
                    </Link>
                    {" "}and consent to KiddoTales collecting and using my child&apos;s information as described above to create personalized storybooks.
                  </span>
                </label>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    type="submit"
                    disabled={!agreed || loading}
                    className="flex-1"
                  >
                    {loading ? "Recording consent…" : "I consent"}
                  </Button>
                  {onDismiss && (
                    <Button type="button" variant="outline" onClick={onDismiss}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
