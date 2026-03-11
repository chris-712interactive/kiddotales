"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  GENDERS,
  INTERESTS,
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_TONES,
  EYE_COLORS,
  type ChildProfile,
} from "@/types";

type ProfileFormData = Omit<ChildProfile, "id" | "createdAt" | "updatedAt">;

export function ProfileFormModal({
  profile,
  onClose,
  onSave,
}: {
  profile: ChildProfile | null;
  onClose: () => void;
  onSave: (data: ProfileFormData) => Promise<void>;
}) {
  const isEdit = Boolean(profile);
  const [form, setForm] = useState<ProfileFormData>({
    name: profile?.name ?? "",
    age: profile?.age ?? 5,
    pronouns: profile?.pronouns ?? "they/them",
    interests: profile?.interests ?? [],
    appearance: profile?.appearance ?? {},
  });
  const [customInterest, setCustomInterest] = useState("");
  const [saving, setSaving] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.name.trim()) return;
    if (form.interests.length === 0) return;

    setSaving(true);
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
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
          aria-labelledby="profile-modal-title"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 id="profile-modal-title" className="text-xl font-semibold text-foreground">
              {isEdit ? "Edit child profile" : "Add child profile"}
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="size-5" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Child&apos;s name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
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
                    e.key === "Enter" &&
                    (e.preventDefault(), addCustomInterest())
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
                        aria-label={`Remove ${i}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3">
              <Label className="text-muted-foreground">
                Character appearance (optional)
              </Label>
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

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                {isEdit ? "Save changes" : "Create profile"}
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
