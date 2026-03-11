"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
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
  ChevronLeft,
  ChevronRight,
  User,
  Heart,
  Palette,
  CheckCircle2,
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
import { TTS_VOICE_LABELS } from "@/lib/stripe";

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
    preferredVoice: "none",
  });

  const [subscriptionTier, setSubscriptionTier] = useState<string>("free");
  const [voiceOptions, setVoiceOptions] = useState<string[]>([]);
  const [playingSample, setPlayingSample] = useState<string | null>(null);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);

  const [customInterest, setCustomInterest] = useState("");
  const [customPronoun, setCustomPronoun] = useState("");
  const [customLifeLesson, setCustomLifeLesson] = useState("");

  const [currentStep, setCurrentStep] = useState(1);
  const [stepDirection, setStepDirection] = useState<"forward" | "back">("forward");
  const [settingsFetched, setSettingsFetched] = useState(false);
  // Voice step only when plan allows AI voice; when auth but not yet fetched, show 5 steps to avoid skipping
  const TOTAL_STEPS =
    settingsFetched
      ? (voiceOptions.length > 0 ? 5 : 4)
      : (status === "authenticated" ? 5 : 4);

  const goToStep = (step: number) => {
    if (step < 1 || step > TOTAL_STEPS) return;
    setStepDirection(step > currentStep ? "forward" : "back");
    setCurrentStep(step);
  };

  // When TOTAL_STEPS shrinks (e.g. fetch reveals free tier), clamp so we don't show a non-existent step
  useEffect(() => {
    if (currentStep > TOTAL_STEPS) setCurrentStep(TOTAL_STEPS);
  }, [TOTAL_STEPS, currentStep]);

  const canProceedFromStep = (step: number): boolean => {
    if (step === 1) return parentGuardianConfirmed;
    if (step === 2) return !!form.childName.trim();
    if (step === 3) return form.interests.length > 0 && (form.lifeLesson !== "custom" || !!customLifeLesson.trim());
    return true;
  };

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
        preferredVoice: form.preferredVoice ?? "none",
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
          setSettingsFetched(true);
        })
        .catch(() => setSettingsFetched(true));
    } else {
      setSubscriptionTier("free");
      setVoiceOptions([]);
      setSettingsFetched(true);
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
    // If not on the last step, advance instead of submitting (e.g. Enter key or accidental submit)
    if (currentStep < TOTAL_STEPS) {
      if (canProceedFromStep(currentStep)) goToStep(currentStep + 1);
      return;
    }
    if (isSubmittingRef.current || isLoading) return;
    isSubmittingRef.current = true;

    const trimmedName = form.childName.trim();
    if (!trimmedName) {
      toast.error("Please enter your child's name.");
      isSubmittingRef.current = false;
      return;
    }
    if (trimmedName.length > 50) {
      toast.error("Child's name must be 50 characters or less.");
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

    if (form.lifeLesson === "custom") {
      const lesson = customLifeLesson.trim();
      if (!lesson) {
        toast.error("Please enter a custom life lesson.");
        isSubmittingRef.current = false;
        return;
      }
      if (lesson.length > 50) {
        toast.error("Life lesson must be 50 characters or less.");
        isSubmittingRef.current = false;
        return;
      }
    }
    if (form.age < 1 || form.age > 12) {
      toast.error("Age must be between 1 and 12.");
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
        if (res.status === 429) {
          toast.error(err.error || "Too many requests. Please wait a moment and try again.");
          setIsLoading(false);
          isSubmittingRef.current = false;
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

  if (isLoading) return <LoadingScreen showSteps hasAiVoice={!!(form.preferredVoice && form.preferredVoice !== "none")} />;

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

      <main className="mx-auto max-w-2xl px-4 pb-24 sm:pb-16">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="mb-2 text-center text-2xl font-bold text-foreground sm:text-3xl">
            Create your storybook
          </h1>
          {bookCount != null && (
            <p className="mb-2 text-center text-sm text-muted-foreground">
              {bookCount.count} of {bookCount.limit} books {bookCount.period === "monthly" ? "this month" : "total"}
            </p>
          )}

          {/* Step indicator */}
          <div className="mb-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {[
              { num: 1, label: "Start", icon: CheckCircle2 },
              { num: 2, label: "Child", icon: User },
              { num: 3, label: "Theme", icon: Heart },
              { num: 4, label: "Art style", icon: Palette },
              { num: 5, label: "Voice", icon: Volume2 },
            ]
              .slice(0, TOTAL_STEPS)
              .map(({ num, label, icon: Icon }) => {
              const canGoTo = num <= currentStep || (num === currentStep + 1 && canProceedFromStep(currentStep));
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => canGoTo && goToStep(num)}
                  disabled={!canGoTo}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all sm:gap-2 sm:px-4",
                    currentStep === num
                      ? "bg-primary text-primary-foreground shadow-md"
                      : num < currentStep
                        ? "bg-primary/20 text-primary hover:bg-primary/30"
                        : "bg-muted/50 text-muted-foreground"
                  )}
                >
                  <Icon className="size-3.5 sm:size-4" />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-current/20 text-xs sm:size-6">
                    {num}
                  </span>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="space-y-0">
            <div className="min-h-[320px] pb-24 sm:min-h-[360px] sm:pb-0">
              <AnimatePresence mode="wait">
                {currentStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: stepDirection === "forward" ? 50 : -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: stepDirection === "forward" ? -50 : 50 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <p className="text-center text-muted-foreground sm:mb-4">
                      Let&apos;s get started. We&apos;ll create a magical story just for your child.
                    </p>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50">
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
                      <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/30 p-4">
                        <p className="text-sm text-muted-foreground">
                          Create a child profile to prefill this form next time.{" "}
                          <Link href="/settings/profiles" className="font-medium text-primary underline hover:no-underline">
                            Add a profile in Settings
                          </Link>
                        </p>
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={surpriseMe}
                    >
                      <Sparkles className="mr-2 size-4" />
                      Surprise me!
                    </Button>
                  </motion.div>
                )}

                {currentStep === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: stepDirection === "forward" ? 50 : -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: stepDirection === "forward" ? -50 : 50 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <p className="text-center text-muted-foreground sm:mb-4">
                      Tell us about your child so we can personalize the story.
                    </p>
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
                          maxLength={50}
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

                    <div className="space-y-2">
                      <Label htmlFor="age">Age</Label>
                      <Select
                        id="age"
                        value={form.age}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, age: Number(e.target.value) }))
                        }
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n} years old
                          </option>
                        ))}
                      </Select>
                    </div>

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
                  </motion.div>
                )}

                {currentStep === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: stepDirection === "forward" ? 50 : -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: stepDirection === "forward" ? -50 : 50 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <p className="text-center text-muted-foreground sm:mb-4">
                      What does your child love? Pick interests and a life lesson for the story.
                    </p>
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
                          maxLength={50}
                        />
                      )}
                    </div>
                  </motion.div>
                )}

                {currentStep === 4 && (
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, x: stepDirection === "forward" ? 50 : -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: stepDirection === "forward" ? -50 : 50 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <p className="text-center text-muted-foreground sm:mb-4">
                      Choose the art style for your story&apos;s illustrations.
                    </p>
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
                              <div className="h-32 overflow-hidden rounded-t-xl sm:h-40">
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
                  </motion.div>
                )}

                {currentStep === 5 && (
                  <motion.div
                    key="step5"
                    initial={{ opacity: 0, x: stepDirection === "forward" ? 50 : -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: stepDirection === "forward" ? -50 : 50 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <p className="text-center text-muted-foreground sm:mb-4">
                      Choose the AI voice for read-aloud (if your plan includes it). You&apos;re almost done!
                    </p>

                    {!settingsFetched ? (
                      <div className="flex items-center justify-center py-8">
                        <p className="text-muted-foreground">Loading voice options…</p>
                      </div>
                    ) : voiceOptions.length > 0 ? (
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
                              (form.preferredVoice ?? "none") === "none"
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
                                (form.preferredVoice ?? "none") === voiceId
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
                    ) : (
                      <div className="rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-4">
                        <p className="text-sm text-muted-foreground">
                          {status === "authenticated" ? (
                            <>
                              <Link href="/pricing" className="font-medium text-primary underline hover:no-underline">
                                Upgrade to Spark
                              </Link>
                              {" "}to unlock AI voice read-aloud for your stories.
                            </>
                          ) : (
                            "Sign in and upgrade your plan to unlock AI voice read-aloud."
                          )}
                        </p>
                      </div>
                    )}

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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Step navigation - sticky on mobile so Next/Create is always visible */}
            <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex items-center justify-between gap-4 border-t border-border bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:static sm:z-auto sm:-mx-0 sm:mt-6 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
              <Button
                type="button"
                variant="outline"
                onClick={() => goToStep(currentStep - 1)}
                disabled={currentStep === 1}
                className="shrink-0"
              >
                <ChevronLeft className="mr-1 size-4" />
                Back
              </Button>
              {currentStep < TOTAL_STEPS ? (
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    if (canProceedFromStep(currentStep)) goToStep(currentStep + 1);
                    else if (currentStep === 1) toast.error("Please confirm you are a parent or guardian.");
                    else if (currentStep === 2) toast.error("Please enter your child's name.");
                    else if (currentStep === 3) toast.error("Please select at least one interest and a life lesson.");
                  }}
                  disabled={!canProceedFromStep(currentStep)}
                  className="min-w-[120px]"
                >
                  Next
                  <ChevronRight className="ml-1 size-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="lg"
                  disabled={isLoading || !parentGuardianConfirmed}
                  className="min-w-[140px]"
                >
                  <BookOpen className="mr-2 size-5" />
                  Create My Book
                </Button>
              )}
            </div>
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
