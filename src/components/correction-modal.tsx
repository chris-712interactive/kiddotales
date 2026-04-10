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
import type { CorrectionMode, LessonPackAccess } from "@/lib/entitlements";
import { isPresetLifeLessonSlug } from "@/lib/life-lesson-access";
import {
  GENDERS,
  INTERESTS,
  LIFE_LESSONS,
  EXTENDED_LIFE_LESSONS,
  type BookData,
  type CreateFormData,
  type CreationMetadata,
} from "@/types";

const ART_STYLE_OPTIONS: Array<{ value: CreateFormData["artStyle"]; label: string }> = [
  { value: "whimsical-watercolor", label: "Whimsical Watercolor" },
  { value: "pixar-3d", label: "Pixar-style 3D" },
  { value: "hand-drawn-classic", label: "Hand-drawn Classic" },
  { value: "vibrant-cartoon", label: "Vibrant Cartoon" },
  { value: "photo-realistic", label: "Photo Realistic" },
];

type BookWithMeta = {
  id: string;
  title: string;
  pages: BookData["pages"];
  creationMetadata?: CreationMetadata;
};

type CorrectionAction = "rename" | "full-regenerate" | "single-page";
type ModalStep = 1 | 2 | 3;

export function CorrectionModal({
  book,
  currentPageIndex,
  correctionMode,
  lessonPackAccess = "default",
  onClose,
  onSuccess,
}: {
  book: BookWithMeta;
  currentPageIndex?: number;
  correctionMode?: CorrectionMode;
  lessonPackAccess?: LessonPackAccess;
  onClose: () => void;
  onSuccess: (updated: BookWithMeta) => void;
}) {
  const router = useRouter();
  const meta = book.creationMetadata;
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
  const [regenReason, setRegenReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<ModalStep>(1);
  const [action, setAction] = useState<CorrectionAction>("rename");
  const [renameOnlyName, setRenameOnlyName] = useState(meta?.childName ?? "");
  const [targetPageIndex, setTargetPageIndex] = useState(() => {
    if (typeof currentPageIndex === "number" && currentPageIndex >= 0) {
      return Math.min(currentPageIndex, Math.max(0, book.pages.length - 1));
    }
    return 0;
  });

  const savedLifeLesson = meta?.lifeLesson ?? "kindness";
  useEffect(() => {
    const access = lessonPackAccess ?? "default";
    const raw = savedLifeLesson;
    if (isPresetLifeLessonSlug(raw, access)) {
      setForm((p) => ({ ...p, lifeLesson: raw }));
      setCustomLifeLesson("");
    } else if (access === "custom") {
      setForm((p) => ({ ...p, lifeLesson: "custom" }));
      setCustomLifeLesson(raw);
    } else {
      setForm((p) => ({ ...p, lifeLesson: "kindness" }));
      setCustomLifeLesson("");
    }
  }, [lessonPackAccess, book.id, savedLifeLesson]);

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

  const supportsSinglePage = correctionMode === "single-page";
  const resolvedLifeLesson = form.lifeLesson === "custom" ? customLifeLesson : form.lifeLesson;
  const actionCost = action === "full-regenerate" ? 1 : 0;

  const canContinueStep2 = () => {
    if (action === "rename") return renameOnlyName.trim().length > 0;
    if (action === "single-page") return targetPageIndex >= 0;
    if (!form.childName.trim()) return false;
    if (form.interests.length === 0) return false;
    if (form.lifeLesson === "custom" && !customLifeLesson.trim()) return false;
    return true;
  };

  const handleFinalSubmit = async () => {
    if (isSubmitting) return;

    const correctionPayload = {
      childName: (action === "rename" ? renameOnlyName : form.childName).trim(),
      age: form.age,
      pronouns: form.pronouns,
      interests: form.interests,
      lifeLesson: resolvedLifeLesson || "kindness",
      artStyle: form.artStyle,
      appearance: form.appearance ?? {},
      regenReason: regenReason.trim() || undefined,
    };

    if (action === "full-regenerate") {
      sessionStorage.setItem(
        PENDING_CORRECTION_KEY,
        JSON.stringify({
          bookId: book.id,
          correction: { ...correctionPayload, correctionMode: "full-regenerate" },
        })
      );
      onClose();
      router.push(`/create?regenerating=${book.id}`);
      return;
    }

    if (action === "single-page") {
      setIsSubmitting(true);
      try {
        const res = await fetch(`/api/books/${book.id}/correct`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...correctionPayload,
            correctionMode: "single-page",
            pageIndex: targetPageIndex,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Failed to regenerate page.");
          return;
        }
        toast.success(`Page ${targetPageIndex + 1} illustration regenerated.`);
        onSuccess(data.book ?? book);
        onClose();
      } catch {
        toast.error("Something went wrong.");
      } finally {
        setIsSubmitting(false);
      }
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

      toast.success("Name updated. No credits used.");
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
          role="dialog"
          aria-modal="true"
          aria-labelledby="correction-modal-title"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 id="correction-modal-title" className="text-xl font-semibold text-foreground">
              Correct book details
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
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
          <div className="mb-4 flex items-center justify-center gap-2 text-xs">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={cn(
                  "rounded-full px-2 py-1",
                  step === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                Step {n}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`step-${step}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {step === 1 && (
                <>
                  <p className="text-sm text-muted-foreground">What do you need to change?</p>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setAction("rename")}
                      className={cn(
                        "w-full rounded-xl border p-3 text-left",
                        action === "rename" ? "border-primary bg-primary/10" : "border-border"
                      )}
                    >
                      <p className="font-medium">Update character name</p>
                      <p className="text-xs text-muted-foreground">Quick text-only update, 0 credits</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAction("full-regenerate")}
                      className={cn(
                        "w-full rounded-xl border p-3 text-left",
                        action === "full-regenerate" ? "border-primary bg-primary/10" : "border-border"
                      )}
                    >
                      <p className="font-medium">Regenerate entire book</p>
                      <p className="text-xs text-muted-foreground">New story + all illustrations, 1 credit</p>
                    </button>
                    <button
                      type="button"
                      disabled={!supportsSinglePage}
                      onClick={() => supportsSinglePage && setAction("single-page")}
                      className={cn(
                        "w-full rounded-xl border p-3 text-left",
                        action === "single-page" ? "border-primary bg-primary/10" : "border-border",
                        !supportsSinglePage && "cursor-not-allowed opacity-60"
                      )}
                    >
                      <p className="font-medium">Regenerate specific page</p>
                      <p className="text-xs text-muted-foreground">
                        Replace one illustration only, 0 credits
                      </p>
                      {!supportsSinglePage && (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                          Available on Magic and Legend plans.
                        </p>
                      )}
                    </button>
                  </div>
                </>
              )}

              {step === 2 && action === "rename" && (
                <>
                  <Label htmlFor="renameName">New character name</Label>
                  <Input
                    id="renameName"
                    value={renameOnlyName}
                    onChange={(e) => setRenameOnlyName(e.target.value)}
                    placeholder="e.g. Luna"
                  />
                  <p className="text-xs text-muted-foreground">
                    This updates the character name in existing text only. No new images or story rewrite.
                  </p>
                </>
              )}

              {step === 2 && action === "single-page" && (
                <>
                  <div>
                    <Label>Page to regenerate</Label>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {book.pages.map((p, idx) => {
                        const isSelected = idx === targetPageIndex;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setTargetPageIndex(idx)}
                            className={cn(
                              "overflow-hidden rounded-xl border text-left transition-all",
                              isSelected
                                ? "border-primary ring-2 ring-primary/40"
                                : "border-border hover:border-primary/50"
                            )}
                            aria-label={`Select page ${idx + 1}`}
                          >
                            <div className="aspect-[4/5] w-full bg-muted">
                              {p.imageUrl ? (
                                <img
                                  src={p.imageUrl}
                                  alt={`Page ${idx + 1}`}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                                  No image
                                </div>
                              )}
                            </div>
                            <div className="px-2 py-1.5 text-xs font-medium">
                              Page {idx + 1}
                              {isSelected ? " (selected)" : ""}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="regenReasonSingle">What should change? (optional)</Label>
                    <textarea
                      id="regenReasonSingle"
                      value={regenReason}
                      onChange={(e) => setRegenReason(e.target.value)}
                      maxLength={300}
                      placeholder="Example: Make this page brighter and show more of the forest background."
                      className="mt-1 min-h-24 w-full rounded-xl border-2 border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{regenReason.trim().length}/300</p>
                  </div>
                </>
              )}

              {step === 2 && action === "full-regenerate" && (
                <>
                  <div>
                    <Label htmlFor="childName">Child&apos;s name</Label>
                    <Input
                      id="childName"
                      value={form.childName}
                      onChange={(e) => setForm((prev) => ({ ...prev, childName: e.target.value }))}
                      placeholder="e.g. Luna"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="age">Age</Label>
                    <Select
                      id="age"
                      value={form.age}
                      onChange={(e) => setForm((prev) => ({ ...prev, age: Number(e.target.value) }))}
                      className="mt-1"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>{n} years old</option>
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
                          onClick={() => setForm((prev) => ({ ...prev, pronouns: g.value }))}
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
                        placeholder="Custom interest"
                        value={customInterest}
                        onChange={(e) => setCustomInterest(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomInterest())}
                      />
                      <Button type="button" variant="outline" onClick={addCustomInterest}>Add</Button>
                    </div>
                    {form.interests.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {form.interests.map((i) => (
                          <span key={i} className="flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-sm">
                            {i}
                            <button type="button" onClick={() => removeInterest(i)} className="hover:text-destructive" aria-label={`Remove ${i}`}>×</button>
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
                      onChange={(e) => setForm((prev) => ({ ...prev, lifeLesson: e.target.value }))}
                      className="mt-1"
                    >
                      {LIFE_LESSONS.map((l) => (
                        <option key={l} value={l}>{l.replace(/-/g, " ")}</option>
                      ))}
                      {lessonPackAccess === "custom" &&
                        EXTENDED_LIFE_LESSONS.map((l) => (
                          <option key={l} value={l}>
                            {l.replace(/-/g, " ")}
                          </option>
                        ))}
                      {lessonPackAccess === "custom" && (
                        <option value="custom">Custom (your words)</option>
                      )}
                    </Select>
                    {lessonPackAccess === "custom" && form.lifeLesson === "custom" && (
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
                      onChange={(e) => setForm((prev) => ({ ...prev, artStyle: e.target.value }))}
                      className="mt-1"
                    >
                      {ART_STYLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="regenReasonFull">What should change? (optional)</Label>
                    <textarea
                      id="regenReasonFull"
                      value={regenReason}
                      onChange={(e) => setRegenReason(e.target.value)}
                      maxLength={300}
                      placeholder="Example: Keep the same lesson but make the tone more playful and adventurous."
                      className="mt-1 min-h-24 w-full rounded-xl border-2 border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{regenReason.trim().length}/300</p>
                  </div>
                </>
              )}

              {step === 3 && (
                <div className="space-y-3">
                  <div className={cn(
                    "rounded-lg p-3",
                    actionCost > 0
                      ? "border-2 border-amber-500/50 bg-amber-50 dark:bg-amber-900/20"
                      : "border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-900/20"
                  )}>
                    <p className={cn("font-semibold", actionCost > 0 ? "text-amber-800 dark:text-amber-200" : "text-emerald-800 dark:text-emerald-200")}>
                      {action === "rename" && "Update character name"}
                      {action === "single-page" && `Regenerate page ${targetPageIndex + 1}`}
                      {action === "full-regenerate" && "Regenerate entire book"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Cost: <span className="font-semibold">{actionCost} book credit{actionCost === 1 ? "" : "s"}</span>
                    </p>
                    {action === "full-regenerate" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        This replaces the current story and all illustrations.
                      </p>
                    )}
                  </div>
                  {!!regenReason.trim() && (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs font-medium text-muted-foreground">AI guidance</p>
                      <p className="mt-1 text-sm">{regenReason.trim()}</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-5 flex gap-2">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={() => setStep((s) => (s - 1) as ModalStep)}>
                Back
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}

            {step < 3 ? (
              <Button
                type="button"
                className="ml-auto"
                disabled={step === 2 && !canContinueStep2()}
                onClick={() => setStep((s) => (s + 1) as ModalStep)}
              >
                Continue
              </Button>
            ) : (
              <Button type="button" className="ml-auto" onClick={handleFinalSubmit} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {action === "rename"
                  ? "Apply name update"
                  : action === "single-page"
                    ? "Regenerate selected page"
                    : "Confirm full regeneration (1 credit)"}
              </Button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
