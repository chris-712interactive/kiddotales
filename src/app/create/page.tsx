"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  BookOpen,
  Mic,
  MicOff,
  Sparkles,
  ArrowLeft,
  Plus,
  X,
  Volume2,
  Play,
  Pause,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthButtons } from "@/components/auth-buttons";
import { LoadingScreen } from "@/components/loading-screen";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PENDING_BOOK_KEY, PENDING_CORRECTION_KEY } from "@/lib/constants";
import {
  GENDERS,
  INTERESTS,
  LIFE_LESSONS,
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_TONES,
  EYE_COLORS,
  type CreateFormData,
  type ChildProfile,
} from "@/types";
import { ParentalConsentModal } from "@/components/parental-consent-modal";
import { TTS_VOICE_LABELS, TTS_DEFAULT_VOICE } from "@/lib/stripe";

const ART_STYLE_CARDS = [
  {
    id: "whimsical-watercolor",
    label: "Whimsical Watercolor",
    description: "Soft, dreamy pastels",
    gradient: "from-pink-200 to-blue-200 dark:from-pink-900/30 dark:to-blue-900/30",
    image: "/artStyles/whimsicalWatercolors.png",
  },
  {
    id: "pixar-3d",
    label: "Pixar-style 3D",
    description: "Vibrant & expressive",
    gradient: "from-amber-200 to-orange-200 dark:from-amber-900/30 dark:to-orange-900/30",
    image: "/artStyles/pixar3d.png",
  },
  {
    id: "hand-drawn-classic",
    label: "Hand-drawn Classic",
    description: "Vintage storybook feel",
    gradient: "from-amber-100 to-yellow-100 dark:from-amber-900/20 dark:to-yellow-900/20",
    image: "/artStyles/handDrawnClassic.png",
  },
  {
    id: "vibrant-cartoon",
    label: "Vibrant Cartoon",
    description: "Bold & playful",
    gradient: "from-green-200 to-teal-200 dark:from-green-900/30 dark:to-teal-900/30",
    image: "/artStyles/vibrantCartoon.png",
  },
];

const SURPRISE_EXAMPLES: CreateFormData[] = [
  {
    childName: "Luna",
    age: 4,
    pronouns: "she/her",
    interests: ["unicorns", "ballet", "forest"],
    lifeLesson: "bravery",
    artStyle: "whimsical-watercolor",
    appearance: {},
  },
  {
    childName: "Max",
    age: 6,
    pronouns: "he/him",
    interests: ["dinosaurs", "space", "robots"],
    lifeLesson: "friendship",
    artStyle: "pixar-3d",
    appearance: {},
  },
  {
    childName: "River",
    age: 5,
    pronouns: "she/her",
    interests: ["ocean", "superheroes", "princesses"],
    lifeLesson: "kindness",
    artStyle: "vibrant-cartoon",
    appearance: {},
  },
];

function CreatePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [consentChecked, setConsentChecked] = useState(false);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [isLoading, setIsLoading] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("regenerating") !== null
  );
  const [bookCount, setBookCount] = useState<{ count: number; limit: number; period?: "total" | "monthly" } | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const [parentGuardianConfirmed, setParentGuardianConfirmed] = useState(false);

  const [form, setForm] = useState<CreateFormData>({
    childName: "",
    age: 5,
    pronouns: "they/them",
    interests: [],
    lifeLesson: "kindness",
    artStyle: "whimsical-watercolor",
    appearance: {},
    preferredVoice: TTS_DEFAULT_VOICE,
  });

  const [subscriptionTier, setSubscriptionTier] = useState<string>("free");
  const [voiceOptions, setVoiceOptions] = useState<string[]>([]);
  const [playingSample, setPlayingSample] = useState<string | null>(null);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);

  const [customInterest, setCustomInterest] = useState("");
  const [customPronoun, setCustomPronoun] = useState("");
  const [customLifeLesson, setCustomLifeLesson] = useState("");

  const applyProfile = (profile: ChildProfile | null) => {
    if (!profile) {
      setSelectedProfileId(null);
      setForm({
        childName: "",
        age: 5,
        pronouns: "they/them",
        interests: [],
        lifeLesson: "kindness",
        artStyle: "whimsical-watercolor",
        appearance: {},
        preferredVoice: form.preferredVoice ?? TTS_DEFAULT_VOICE,
      });
      return;
    }
    setSelectedProfileId(profile.id);
    setForm({
      ...form,
      childName: profile.name,
      age: profile.age,
      pronouns: profile.pronouns,
      interests: profile.interests ?? [],
      appearance: profile.appearance ?? {},
    });
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

  const surpriseMe = () => {
    const example =
      SURPRISE_EXAMPLES[Math.floor(Math.random() * SURPRISE_EXAMPLES.length)];
    setForm(example);
    toast.success("Surprise! Form filled with a fun example.");
  };

  const startVoiceInput = useCallback(() => {
    if (typeof window === "undefined" || !("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast.error("Voice input is not supported in your browser.");
      return;
    }

    const SpeechRecognitionAPI = (window as unknown as { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      toast.error("Voice input is not supported.");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((r: SpeechRecognitionResult) => r[0].transcript)
        .join("");
      if (transcript) {
        setForm((prev) => ({ ...prev, childName: transcript.trim().split(" ")[0] || prev.childName }));
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      toast.error("Could not hear you. Try again.");
    };

    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    toast.info("Listening... Tell me about your child!");
  }, []);

  const stopVoiceInput = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const isSubmittingRef = useRef(false);
  const regenerationStartedRef = useRef(false);

  useEffect(() => {
    fetch("/api/books/count")
      .then((r) => r.json())
      .then(setBookCount)
      .catch(() => setBookCount(null));
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/child-profiles")
      .then((r) => r.json())
      .then((data) => setProfiles(Array.isArray(data) ? data : []))
      .catch(() => setProfiles([]));
  }, [status]);

  useEffect(() => {
    const regenerating = searchParams.get("regenerating");
    if (!regenerating || status !== "authenticated") return;
    if (regenerationStartedRef.current) return;
    regenerationStartedRef.current = true;

    const payloadStr = typeof window !== "undefined" ? sessionStorage.getItem(PENDING_CORRECTION_KEY) : null;
    if (!payloadStr) {
      regenerationStartedRef.current = false;
      toast.error("Correction session expired. Please try again.");
      router.replace("/create");
      return;
    }

    let payload: { bookId: string; correction: Record<string, unknown> };
    try {
      payload = JSON.parse(payloadStr);
    } catch {
      regenerationStartedRef.current = false;
      sessionStorage.removeItem(PENDING_CORRECTION_KEY);
      toast.error("Invalid correction data. Please try again.");
      router.replace("/create");
      return;
    }

    if (payload.bookId !== regenerating) {
      regenerationStartedRef.current = false;
      sessionStorage.removeItem(PENDING_CORRECTION_KEY);
      router.replace("/create");
      return;
    }

    setIsLoading(true);
    fetch(`/api/books/${regenerating}/correct`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload.correction),
    })
      .then((r) => r.json())
      .then((data) => {
        sessionStorage.removeItem(PENDING_CORRECTION_KEY);
        if (!data.success && data.error) {
          regenerationStartedRef.current = false;
          toast.error(data.error || "Failed to apply correction.");
          setIsLoading(false);
          router.replace("/create");
          return;
        }
        const book = data.book;
        if (book?.id && typeof window !== "undefined") {
          sessionStorage.setItem(PENDING_BOOK_KEY, JSON.stringify(book));
        }
        router.replace(book?.id ? `/book?id=${book.id}` : "/create");
      })
      .catch(() => {
        regenerationStartedRef.current = false;
        sessionStorage.removeItem(PENDING_CORRECTION_KEY);
        toast.error("Something went wrong.");
        setIsLoading(false);
        router.replace("/create");
      });
  }, [searchParams, status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/user/settings")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.subscriptionTier) setSubscriptionTier(data.subscriptionTier);
          if (Array.isArray(data?.voiceOptions)) setVoiceOptions(data.voiceOptions);
        })
        .catch(() => {});
    } else {
      setSubscriptionTier("free");
      setVoiceOptions([]);
    }
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) {
      setConsentChecked(true);
      setNeedsConsent(false);
      return;
    }
    fetch("/api/user/consent")
      .then((r) => r.json())
      .then((data) => {
        setConsentChecked(true);
        setNeedsConsent(!data.hasConsent);
      })
      .catch(() => {
        setConsentChecked(true);
        setNeedsConsent(false);
      });
  }, [status, session?.user?.id]);

  const handleConsent = async () => {
    const res = await fetch("/api/user/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "grant" }),
    });
    if (!res.ok) throw new Error("Failed to record consent");
    setNeedsConsent(false);
    toast.success("Thank you! You can now create your storybook.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;
    isSubmittingRef.current = true;

    if (!form.childName.trim()) {
      toast.error("Please enter your child's name.");
      isSubmittingRef.current = false;
      return;
    }

    if (!parentGuardianConfirmed) {
      toast.error("Please confirm you are a parent or guardian.");
      isSubmittingRef.current = false;
      return;
    }

    if (form.interests.length === 0) {
      toast.error("Please select at least one interest.");
      isSubmittingRef.current = false;
      return;
    }

    if (form.lifeLesson === "custom" && !customLifeLesson.trim()) {
      toast.error("Please enter a custom life lesson.");
      isSubmittingRef.current = false;
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        ...form,
        pronouns: resolvedPronouns || form.pronouns,
        lifeLesson: resolvedLifeLesson || form.lifeLesson,
      };
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 403) {
          toast.error(err.error || "You've reached your book limit.");
          router.push("/pricing");
          return;
        }
        if (res.status === 401) {
          toast.error("Please sign in to create books.");
          router.push("/sign-in?callbackUrl=/create");
          return;
        }
        throw new Error(err.error || "Failed to generate book");
      }

      const book = await res.json();
      if (typeof window !== "undefined") {
        sessionStorage.setItem(PENDING_BOOK_KEY, JSON.stringify(book));
      }
      setBookCount((prev) =>
        prev ? { ...prev, count: prev.count + 1 } : { count: 1, limit: 3, period: "total" }
      );
      router.push(book.id ? `/book?id=${book.id}` : "/book");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const resolvedPronouns = form.pronouns === "custom" ? customPronoun : form.pronouns;
  const resolvedLifeLesson = form.lifeLesson === "custom" ? customLifeLesson : form.lifeLesson;

  if (isLoading) return <LoadingScreen showSteps />;

  if (consentChecked && needsConsent) {
    return (
      <>
        <ParentalConsentModal
          onConsent={handleConsent}
          onDismiss={() => router.push("/")}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)]">
      <header className="flex items-center justify-between px-4 py-4 md:px-8">
        <Link href="/" className="flex items-center gap-2">
        <Image
            src="/branding/logo.svg"
            alt="KiddoTales"
            width={32}
            height={32}
            className="size-8 object-contain"
          />
          <span className="text-xl font-bold">KiddoTales</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 size-4" />
              Back
            </Button>
          </Link>
          <AuthButtons />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="mb-2 text-center text-3xl font-bold text-foreground">
            Create your storybook
          </h1>
          {bookCount != null && (
            <p className="mb-2 text-center text-sm text-muted-foreground">
              {bookCount.count} of {bookCount.limit} books {bookCount.period === "monthly" ? "this month" : "total"}
            </p>
          )}
          <p className="mb-6 text-center text-muted-foreground">
            Fill in the details below. We&apos;ll create a magical story just for your child.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Age gate / parent confirmation */}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-border bg-muted/30 p-4 transition-colors hover:bg-muted/50">
              <input
                type="checkbox"
                checked={parentGuardianConfirmed}
                onChange={(e) => setParentGuardianConfirmed(e.target.checked)}
                className="mt-1 rounded border-2"
              />
              <span className="text-sm text-foreground">
                I am a parent or guardian creating a story for my child.
              </span>
            </label>
            {/* Optional: Child profile selector */}
            {profiles.length > 0 ? (
              <div className="space-y-2">
                <Label>Use a saved profile (optional)</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={selectedProfileId === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => applyProfile(null)}
                  >
                    Start fresh
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
            ) : (
              <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  Create a child profile to prefill this form next time.{" "}
                  <Link href="/settings/profiles" className="font-medium text-primary underline hover:no-underline">
                    Add a profile in Settings
                  </Link>
                </p>
              </div>
            )}

            {/* Child's name + voice */}
            <div className="space-y-2">
              <Label htmlFor="childName">Child&apos;s name</Label>
              <div className="flex gap-2">
                <Input
                  id="childName"
                  placeholder="e.g. Luna"
                  value={form.childName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, childName: e.target.value }))
                  }
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant={isListening ? "default" : "outline"}
                  size="icon"
                  onClick={isListening ? stopVoiceInput : startVoiceInput}
                  title="Tell me about your child..."
                >
                  {isListening ? (
                    <MicOff className="size-5" />
                  ) : (
                    <Mic className="size-5" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Click the mic to speak your child&apos;s name
              </p>
            </div>

            {/* Age */}
            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              <Select
                id="age"
                value={form.age}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, age: Number(e.target.value) }))
                }
              >
                {Array.from({ length: 9 }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={n}>
                    {n} years old
                  </option>
                ))}
              </Select>
            </div>

            {/* Pronouns */}
            <div className="space-y-2">
              <Label>Gender</Label>
              <div className="flex flex-wrap items-center gap-2">
                {GENDERS.map((gender) => (
                  <Button
                    key={gender.value}
                    type="button"
                    variant={form.pronouns === gender.value ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, pronouns: gender.value }))
                    }
                  >
                    {gender.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Optional: Character appearance */}
            <div className="space-y-3 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/30 p-4">
              <div>
                <Label className="text-muted-foreground">Character appearance (optional)</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Add details to make the character look more like your child in the illustrations
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label htmlFor="hairColor" className="text-xs">Hair color</Label>
                  <Select
                    id="hairColor"
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
                      <option key={o.value || "any"} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="hairStyle" className="text-xs">Hair style</Label>
                  <Select
                    id="hairStyle"
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
                      <option key={o.value || "any"} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="skinTone" className="text-xs">Skin tone</Label>
                  <Select
                    id="skinTone"
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
                      <option key={o.value || "any"} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="eyeColor" className="text-xs">Eye color</Label>
                  <Select
                    id="eyeColor"
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
                      <option key={o.value || "any"} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <label className="flex cursor-pointer items-center gap-2">
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
                    className="rounded border-muted-foreground/50"
                  />
                  <span className="text-sm">Glasses</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
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
                    className="rounded border-muted-foreground/50"
                  />
                  <span className="text-sm">Freckles</span>
                </label>
              </div>
            </div>

            {/* Interests */}
            <div className="space-y-2">
              <Label>Interests (select as many as you like)</Label>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleInterest(i)}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-medium transition-all",
                      form.interests.includes(i)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {i}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Input
                  placeholder="Add custom interest"
                  value={customInterest}
                  onChange={(e) => setCustomInterest(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomInterest())}
                />
                <Button type="button" variant="outline" onClick={addCustomInterest}>
                  <Plus className="size-4" />
                </Button>
              </div>
              {form.interests.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {form.interests.map((i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1 rounded-full bg-primary/20 px-3 py-1 text-sm"
                    >
                      {i}
                      <button
                        type="button"
                        onClick={() => removeInterest(i)}
                        className="hover:text-destructive"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Life lesson */}
            <div className="space-y-2">
              <Label htmlFor="lifeLesson">Life lesson</Label>
              <Select
                id="lifeLesson"
                value={form.lifeLesson}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, lifeLesson: e.target.value }))
                }
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
                />
              )}
            </div>

            {/* Art style */}
            <div className="space-y-3">
              <Label>Art style</Label>
              <div className="grid grid-cols-2 gap-3">
                {ART_STYLE_CARDS.map((style) => (
                  <motion.div
                    key={style.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card
                      className={cn(
                        "cursor-pointer transition-all",
                        form.artStyle === style.id
                          ? "ring-2 ring-primary"
                          : "hover:border-primary/50"
                      )}
                      onClick={() =>
                        setForm((prev) => ({ ...prev, artStyle: style.id }))
                      }
                    >
                      <div className="h-40 rounded-t-xl overflow-hidden">
                        {style.image ? (
                          <img
                            src={style.image}
                            alt={style.label}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div
                            className={cn(
                              "h-full w-full bg-gradient-to-br",
                              style.gradient
                            )}
                          />
                        )}
                      </div>
                      <CardHeader className="py-3">
                        <CardTitle className="text-base">
                          {style.label}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {style.description}
                        </p>
                      </CardHeader>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Storyteller voice (Spark+ only) */}
            {voiceOptions.length > 0 && (
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Volume2 className="size-4" />
                  Storyteller voice
                </Label>
                <p className="text-sm text-muted-foreground">
                  Choose the AI voice that will read your story aloud. You have a limited number of AI voice books per month.
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {/* No AI voice option - saves voice slot */}
                  <Card
                    className={cn(
                      "cursor-pointer transition-all",
                      (form.preferredVoice ?? TTS_DEFAULT_VOICE) === "none"
                        ? "ring-2 ring-primary"
                        : "hover:border-primary/50"
                    )}
                    onClick={() =>
                      setForm((prev) => ({ ...prev, preferredVoice: "none" }))
                    }
                  >
                    <CardContent className="flex items-center p-3">
                      <span className="font-medium">
                        No AI voice (browser voice only)
                      </span>
                    </CardContent>
                  </Card>
                  {voiceOptions.map((voiceId) => (
                    <Card
                      key={voiceId}
                      className={cn(
                        "cursor-pointer transition-all",
                        (form.preferredVoice ?? TTS_DEFAULT_VOICE) === voiceId
                          ? "ring-2 ring-primary"
                          : "hover:border-primary/50"
                      )}
                      onClick={() =>
                        setForm((prev) => ({ ...prev, preferredVoice: voiceId }))
                      }
                    >
                      <CardContent className="flex items-center justify-between p-3">
                        <span className="font-medium">
                          {TTS_VOICE_LABELS[voiceId] ?? voiceId}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (playingSample === voiceId) {
                              sampleAudioRef.current?.pause();
                              sampleAudioRef.current = null;
                              setPlayingSample(null);
                              return;
                            }
                            const audio = new Audio(`/voice-samples/${voiceId}.mp3`);
                            sampleAudioRef.current = audio;
                            setPlayingSample(voiceId);
                            audio.play();
                            audio.onended = () => {
                              setPlayingSample(null);
                              sampleAudioRef.current = null;
                            };
                          }}
                        >
                          {playingSample === voiceId ? (
                            <Pause className="size-4" />
                          ) : (
                            <Play className="size-4" />
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Free tier teaser */}
            {status === "authenticated" && voiceOptions.length === 0 && (
              <div className="rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  <Link href="/pricing" className="font-medium text-primary underline hover:no-underline">
                    Upgrade to Spark
                  </Link>
                  {" "}to unlock AI voice read-aloud for your stories.
                </p>
              </div>
            )}

            {/* Surprise me */}
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={surpriseMe}
            >
              <Sparkles className="mr-2 size-4" />
              Surprise me!
            </Button>

            {/* Save as profile */}
            {form.childName.trim() && form.interests.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={async () => {
                  try {
                    const pronouns =
                      form.pronouns === "custom" ? customPronoun : form.pronouns;
                    const lifeLesson =
                      form.lifeLesson === "custom"
                        ? customLifeLesson
                        : form.lifeLesson;
                    const res = await fetch("/api/child-profiles", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: form.childName.trim(),
                        age: form.age,
                        pronouns: pronouns || "they/them",
                        interests: form.interests,
                        appearance: form.appearance ?? {},
                      }),
                    });
                    if (!res.ok) throw new Error("Failed to save");
                    const profile = await res.json();
                    setProfiles((prev) => [profile, ...prev]);
                    setSelectedProfileId(profile.id);
                    toast.success(`Saved "${profile.name}" as a profile.`);
                  } catch {
                    toast.error("Could not save profile.");
                  }
                }}
              >
                Save as profile for next time
              </Button>
            )}

            {/* Submit */}
            <Button type="submit" size="lg" className="w-full" disabled={isLoading || !parentGuardianConfirmed}>
              <BookOpen className="mr-2 size-5" />
              Create My Book
            </Button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<LoadingScreen showSteps />}>
      <CreatePageContent />
    </Suspense>
  );
}
