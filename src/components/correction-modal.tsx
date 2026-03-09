"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PENDING_CORRECTION_KEY } from "@/lib/constants";
import {
  GENDERS,
  INTERESTS,
  LIFE_LESSONS,
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_TONES,
  EYE_COLORS,
  type CreateFormData,
  type CreationMetadata,
  type ChildProfile,
} from "@/types";

function isNameOnlyChange(original: CreationMetadata | undefined, corrected: CreateFormData): boolean {
  if (!original) return false;
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  if (original.childName === corrected.childName) return false;
  if (!same(original.age, corrected.age)) return false;
  if (!same(original.pronouns, corrected.pronouns)) return false;
  if (!same(original.interests, corrected.interests)) return false;
  if (!same(original.lifeLesson, corrected.lifeLesson)) return false;
  if (!same(original.artStyle, corrected.artStyle)) return false;
  if (!same(original.appearance ?? {}, corrected.appearance ?? {})) return false;
  return true;
}

const ART_STYLE_OPTIONS = [
  { value: "whimsical-watercolor", label: "Whimsical Watercolor" },
  { value: "pixar-3d", label: "Pixar-style 3D" },
  { value: "hand-drawn-classic", label: "Hand-drawn Classic" },
  { value: "vibrant-cartoon", label: "Vibrant Cartoon" },
];

type BookWithMeta = {
  id: string;
  title: string;
  pages: { text: string; [key: string]: unknown }[];
  creationMetadata?: CreationMetadata;
};

export function CorrectionModal({
  book,
  onClose,
  onSuccess,
}: {
  book: BookWithMeta;
  onClose: () => void;
  onSuccess: (updated: BookWithMeta) => void;
}) {
  const router = useRouter();
  const meta = book.creationMetadata;
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const [form, setForm] = useState<CreateFormData>({
    childName: meta?.childName ?? "",
    age: meta?.age ?? 5,
    pronouns: meta?.pronouns ?? "they/them",
    interests: meta?.interests ?? [],
    lifeLesson: meta?.lifeLesson ?? "kindness",
    artStyle: meta?.artStyle ?? "whimsical-watercolor",
    appearance: meta?.appearance ?? {},
  });
  const [customInterest, setCustomInterest] = useState("");
  const [customLifeLesson, setCustomLifeLesson] = useState("");
  const [showCreditConfirm, setShowCreditConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/child-profiles")
      .then((r) => r.json())
      .then((data) => setProfiles(Array.isArray(data) ? data : []))
      .catch(() => setProfiles([]));
  }, []);

  const applyProfile = (profile: ChildProfile | null) => {
    if (!profile) {
      setSelectedProfileId(null);
      setForm((prev) => ({
        ...prev,
        childName: meta?.childName ?? "",
        age: meta?.age ?? 5,
        pronouns: meta?.pronouns ?? "they/them",
        interests: meta?.interests ?? [],
        appearance: meta?.appearance ?? {},
      }));
      return;
    }
    setSelectedProfileId(profile.id);
    setForm((prev) => ({
      ...prev,
      childName: profile.name,
      age: profile.age,
      pronouns: profile.pronouns,
      interests: profile.interests ?? [],
      appearance: profile.appearance ?? {},
    }));
  };

  const toggleInterest = (interest: string) => {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  const addCustomInterest = () => {
    const trimmed = customInterest.trim().toLowerCase();
    if (trimmed && !form.interests.includes(trimmed)) {
      setForm((prev) => ({ ...prev, interests: [...prev.interests, trimmed] }));
      setCustomInterest("");
    }
  };

  const removeInterest = (interest: string) => {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.filter((i) => i !== interest),
    }));
  };

  const requiresRegeneration = !isNameOnlyChange(meta, form);
  const resolvedLifeLesson = form.lifeLesson === "custom" ? customLifeLesson : form.lifeLesson;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!form.childName.trim()) {
      toast.error("Child name is required.");
      return;
    }
    if (form.interests.length === 0) {
      toast.error("Please select at least one interest.");
      return;
    }
    if (form.lifeLesson === "custom" && !customLifeLesson.trim()) {
      toast.error("Please enter a custom life lesson.");
      return;
    }

    if (requiresRegeneration && !showCreditConfirm) {
      setShowCreditConfirm(true);
      return;
    }

    const correctionPayload = {
      childName: form.childName.trim(),
      age: form.age,
      pronouns: form.pronouns,
      interests: form.interests,
      lifeLesson: resolvedLifeLesson || "kindness",
      artStyle: form.artStyle,
      appearance: form.appearance ?? {},
    };

    if (requiresRegeneration) {
      sessionStorage.setItem(
        PENDING_CORRECTION_KEY,
        JSON.stringify({ bookId: book.id, correction: correctionPayload })
      );
      onClose();
      router.push(`/create?regenerating=${book.id}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/books/${book.id}/correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(correctionPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to apply correction.");
        return;
      }

      toast.success("Correction applied. No credits used.");
      onSuccess(data.book ?? book);
      onClose();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border-2 border-border bg-card p-6 shadow-xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">
              Correct book details
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="size-5" />
            </Button>
          </div>

          {!meta && (
            <p className="mb-4 rounded-lg bg-amber-100 p-3 text-sm text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
              This book was created before we stored creation details. You can
              still correct it, but any change will require regenerating the
              story and illustrations (1 credit).
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Child profile selector */}
            {profiles.length > 0 && (
              <div className="space-y-2">
                <Label>Use a saved profile (optional)</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={selectedProfileId === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => applyProfile(null)}
                  >
                    From book
                  </Button>
                  {profiles.map((p) => (
                    <Button
                      key={p.id}
                      type="button"
                      variant={selectedProfileId === p.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => applyProfile(p)}
                    >
                      {p.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="childName">Child&apos;s name</Label>
              <Input
                id="childName"
                value={form.childName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, childName: e.target.value }))
                }
                placeholder="e.g. Luna"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="age">Age</Label>
              <Select
                id="age"
                value={form.age}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, age: Number(e.target.value) }))
                }
                className="mt-1"
              >
                {Array.from({ length: 9 }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={n}>
                    {n} years old
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label>Gender</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {GENDERS.map((g) => (
                  <Button
                    key={g.value}
                    type="button"
                    variant={form.pronouns === g.value ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, pronouns: g.value }))
                    }
                  >
                    {g.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label>Interests</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {INTERESTS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleInterest(i)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm",
                      form.interests.includes(i)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {i}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  placeholder="Custom"
                  value={customInterest}
                  onChange={(e) => setCustomInterest(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && (e.preventDefault(), addCustomInterest())
                  }
                />
                <Button type="button" variant="outline" onClick={addCustomInterest}>
                  Add
                </Button>
              </div>
              {form.interests.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {form.interests.map((i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-sm"
                    >
                      {i}
                      <button
                        type="button"
                        onClick={() => removeInterest(i)}
                        className="hover:text-destructive"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="lifeLesson">Life lesson</Label>
              <Select
                id="lifeLesson"
                value={form.lifeLesson}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, lifeLesson: e.target.value }))
                }
                className="mt-1"
              >
                {LIFE_LESSONS.map((l) => (
                  <option key={l} value={l}>
                    {l.replace(/-/g, " ")}
                  </option>
                ))}
                <option value="custom">Custom</option>
              </Select>
              {form.lifeLesson === "custom" && (
                <Input
                  placeholder="e.g. being patient"
                  value={customLifeLesson}
                  onChange={(e) => setCustomLifeLesson(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>

            <div>
              <Label htmlFor="artStyle">Art style</Label>
              <Select
                id="artStyle"
                value={form.artStyle}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, artStyle: e.target.value }))
                }
                className="mt-1"
              >
                {ART_STYLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3">
              <Label className="text-muted-foreground">Character appearance</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div>
                  <Label className="text-xs">Hair color</Label>
                  <Select
                    value={form.appearance?.hairColor ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        appearance: {
                          ...prev.appearance,
                          hairColor: e.target.value || undefined,
                        },
                      }))
                    }
                  >
                    {HAIR_COLORS.map((o) => (
                      <option key={o.value || "any"} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Hair style</Label>
                  <Select
                    value={form.appearance?.hairStyle ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        appearance: {
                          ...prev.appearance,
                          hairStyle: e.target.value || undefined,
                        },
                      }))
                    }
                  >
                    {HAIR_STYLES.map((o) => (
                      <option key={o.value || "any"} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Skin tone</Label>
                  <Select
                    value={form.appearance?.skinTone ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        appearance: {
                          ...prev.appearance,
                          skinTone: e.target.value || undefined,
                        },
                      }))
                    }
                  >
                    {SKIN_TONES.map((o) => (
                      <option key={o.value || "any"} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Eye color</Label>
                  <Select
                    value={form.appearance?.eyeColor ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        appearance: {
                          ...prev.appearance,
                          eyeColor: e.target.value || undefined,
                        },
                      }))
                    }
                  >
                    {EYE_COLORS.map((o) => (
                      <option key={o.value || "any"} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.appearance?.glasses ?? false}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        appearance: {
                          ...prev.appearance,
                          glasses: e.target.checked || undefined,
                        },
                      }))
                    }
                    className="rounded"
                  />
                  Glasses
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.appearance?.freckles ?? false}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        appearance: {
                          ...prev.appearance,
                          freckles: e.target.checked || undefined,
                        },
                      }))
                    }
                    className="rounded"
                  />
                  Freckles
                </label>
              </div>
            </div>

            {requiresRegeneration && !showCreditConfirm && (
              <p className="text-sm text-muted-foreground">
                Changing these fields will regenerate the story and illustrations
                (1 book credit).
              </p>
            )}

            {showCreditConfirm && requiresRegeneration ? (
              <div className="rounded-lg border-2 border-amber-500/50 bg-amber-50 p-4 dark:bg-amber-900/20">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  This will use 1 book credit
                </p>
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                  Your changes require regenerating the story and illustrations.
                  This will replace the current book content.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreditConfirm(false)}
                  >
                    Go back
                  </Button>
                  <Button
                    onClick={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : null}
                    Confirm & apply
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  Apply correction
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            )}
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
