"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "", label: "Select a category (optional)" },
  { value: "general", label: "General feedback" },
  { value: "bug", label: "Bug report" },
  { value: "feature", label: "Feature request" },
  { value: "other", label: "Other" },
] as const;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
};

export function FeedbackModal({ isOpen, onClose, userEmail }: Props) {
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      toast.error("Please enter your feedback.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          category: category || undefined,
          email: userEmail ?? (email.trim() || undefined),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to submit feedback.");
        return;
      }
      toast.success("Thank you! Your feedback has been submitted.");
      setMessage("");
      setCategory("");
      setEmail("");
      onClose();
    } catch {
      toast.error("Failed to submit feedback.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
        role="presentation"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-border bg-card p-6 shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-modal-title"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-5 text-primary" aria-hidden />
              <h2 id="feedback-modal-title" className="text-xl font-semibold text-foreground">
                Send feedback
              </h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="size-5" />
            </Button>
          </div>

          <p className="mb-4 text-sm text-muted-foreground">
            We&apos;d love to hear from you. Share your thoughts, report a bug, or suggest a feature.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="feedback-category">Category</Label>
              <select
                id="feedback-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 flex h-12 w-full appearance-none rounded-xl border-2 border-input bg-background px-4 py-2 pr-10 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value || "empty"} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="feedback-message">Message *</Label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you think..."
                rows={4}
                maxLength={2000}
                className="mt-1 flex w-full rounded-xl border-2 border-input bg-background px-4 py-3 text-base transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {message.length} / 2000 characters
              </p>
            </div>

            {!userEmail && (
              <div>
                <Label htmlFor="feedback-email">Email (optional)</Label>
                <input
                  id="feedback-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="mt-1 flex h-12 w-full rounded-xl border-2 border-input bg-background px-4 py-2 text-base transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Include if you&apos;d like us to follow up
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Sending…" : "Send feedback"}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
