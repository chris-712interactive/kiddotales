"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  FileText,
  Music,
  Play,
  Square,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type PreviewMode = "text" | "illustrations" | "pdf" | "voice";

export default function UnauthenticatedLandingArtDemo({
  previewMode,
}: {
  previewMode: PreviewMode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/20">
      <div className="absolute inset-0 opacity-30">
        <div className="h-full w-full bg-gradient-to-br from-primary/20 via-transparent to-pastel-mint" />
      </div>

      <div className="relative p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            {previewMode === "text" && <Sparkles className="size-4 text-primary" />}
            {previewMode === "illustrations" && <Sparkles className="size-4 text-primary" />}
            {previewMode === "pdf" && <FileText className="size-4 text-primary" />}
            {previewMode === "text" && "Story preview"}
            {previewMode === "illustrations" && "Illustration preview"}
            {previewMode === "pdf" && "PDF preview"}
          </div>
          <div className="text-xs text-muted-foreground">
            {
              previewMode === "text" && "Generated text"
            }
            {
              previewMode === "illustrations" && "AI art style"
            }
            {
              previewMode === "pdf" && "Print-ready layout"
            }
          </div>
        </div>

        <AnimateSwitch previewMode={previewMode} />
      </div>
    </div>
  );
}

function AnimateSwitch({ previewMode }: { previewMode: PreviewMode }) {
  const reducedMotion = useReducedMotion();
  const voiceSampleSrc = "/voice-samples/landingPageSamples/fable-exampleAudio1.mp3";
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [voicePlaying, setVoicePlaying] = useState(false);

  const carouselImages = useMemo(
    () => [
      { src: "/artStyles/pixar3d.png", label: "Pixar 3D" },
      {
        src: "/artStyles/whimsicalWatercolors.png",
        label: "Whimsical Watercolors",
      },
      { src: "/artStyles/handDrawnClassic.png", label: "Hand Drawn Classic" },
      { src: "/artStyles/vibrantCartoon.png", label: "Vibrant Cartoon" },
    ],
    []
  );
  const pdfImages = useMemo(
    () => [
      { src: "/samples/pdfPortraitExampleCover.png", label: "PDF Portrait Example Cover" },
      { src: "/samples/pdfPortraitExampleInternal.png", label: "PDF Portrait Example Internal" },
      { src: "/samples/pdfLandscapeExample.png", label: "PDF Landscape Example Cover" },
    ],
    []
  );
  const [artIndex, setArtIndex] = useState(0);
  const [pdfIndex, setPdfIndex] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    if (previewMode === "illustrations") {
      const id = window.setInterval(() => {
        setArtIndex((v) => (v + 1) % carouselImages.length);
      }, 2600);
      return () => window.clearInterval(id);
    }
    if (previewMode === "pdf") {
      const idPdf = window.setInterval(() => {
        setPdfIndex((v) => (v + 1) % pdfImages.length);
      }, 2600);
      return () => window.clearInterval(idPdf);
    }
  }, [carouselImages.length, previewMode, reducedMotion, pdfImages.length]);

  useEffect(() => {
    // Stop read-aloud preview when leaving the "voice" tab.
    if (previewMode !== "voice") {
      audioRef.current?.pause();
    }
  }, [previewMode]);

  if (previewMode === "illustrations") {
    const currentArt = carouselImages[artIndex] ?? carouselImages[0];
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="relative h-64 w-full overflow-hidden rounded-xl bg-muted/30 sm:h-72">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentArt.src}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.55 }}
              className="absolute inset-0"
            >
              <Image
                src={currentArt.src}
                alt={`${currentArt.label ?? "AI art style"} example`}
                width={1200}
                height={900}
                className="h-full w-full object-cover"
                loading="lazy"
                unoptimized
              />
            </motion.div>
          </AnimatePresence>

          <div className="absolute left-3 top-3 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-foreground backdrop-blur">
            {currentArt.label}
          </div>
        </div>
      </motion.div>
    );
  }

  if (previewMode === "text") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="min-w-100">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Story preview
              </div>
              <div className="mt-1 truncate text-base font-bold text-foreground">
                The Moonlight Rocket, starring &quot;Ava&quot;
              </div>
            </div>
          </div>

              <div className="mt-3 space-y-2">
            <p className="text-sm text-muted-foreground">
              Ava pressed the bedtime button. Whoosh! A tiny rocket appeared
              right above the blanket - ready for a gentle adventure.
            </p>
            <p className="text-sm text-muted-foreground">
              &quot;We&#39;ll visit the Dreamy Cloud Library,&quot; said the
              Moon. Ava
              listened closely... and soon the whole room felt warm and safe.
            </p>
          </div>

          <div className="mt-4 rounded-lg bg-primary/10 p-3 text-xs text-muted-foreground">
            Built from your child’s details: name, age, and favorite things.
          </div>
        </div>
      </motion.div>
    );
  }

  if (previewMode === "pdf") {
    const currentPdf = pdfImages[pdfIndex] ?? pdfImages[0];
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="relative h-64 w-full overflow-hidden rounded-xl bg-muted/30 sm:h-72">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPdf.src}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.55 }}
              className="absolute inset-0"
            >
              <Image
                src={currentPdf.src}
                alt={`${currentPdf.label ?? "PDF preview"} example`}
                width={1200}
                height={900}
                className="h-full w-full object-cover"
                loading="lazy"
                unoptimized
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-left">
            <div className="text-sm font-semibold text-foreground">
              Voice narration
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Listen as bedtime reads itself.
            </div>
          </div>
          <Music className="size-5 text-primary" />
        </div>

        <audio
          ref={audioRef}
          src={voiceSampleSrc}
          preload="none"
          onPlay={() => setVoicePlaying(true)}
          onPause={() => setVoicePlaying(false)}
          onEnded={() => setVoicePlaying(false)}
        />

        <div className="mt-4 text-xs text-muted-foreground">
          {voicePlaying
            ? "Now playing: Fable read-aloud sample"
            : "Tap the player below to hear the Fable read-aloud sample"}
        </div>

        <div className="mt-4 flex justify-center items-center gap-2 w-full" aria-hidden="true">
          {[6, 10, 14, 9, 18, 12, 20, 14, 9, 18, 12, 20, 8, 9, 18, 12, 20, 8].map((h, i) => (
            <div
              key={i}
              className={voicePlaying && !reducedMotion ? "w-3 rounded-full bg-primary/40 animate-float" : "w-3 rounded-full bg-primary/40"}
              style={{
                height: h * 2,
                animationDelay: `${i * 80}ms`,
                animationDuration: `${1000}ms`,
              }}
            />
          ))}
        </div>

        <button
          type="button"
          className="mt-4 flex w-full items-center justify-between gap-3 rounded-lg bg-primary/10 p-3 text-left transition-colors hover:bg-primary/15"
          onClick={async () => {
            const el = audioRef.current;
            if (!el) return;
            if (el.paused) {
              try {
                await el.play();
              } catch {
                // Autoplay policies can prevent play until user interaction.
              }
            } else {
              el.pause();
              el.currentTime = 0;
            }
          }}
          aria-label={voicePlaying ? "Stop read-aloud preview" : "Play read-aloud preview"}
        >
          <div className="min-w-0">
            <div className="text-xs truncate font-semibold text-foreground">
              Fable voice sample narration
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {voicePlaying ? "Playing now - tap to stop" : "Tap to play"}
            </div>
          </div>
          <div className="flex size-10 items-center justify-center rounded-full border border-border bg-card">
            {voicePlaying ? (
              <Square className="size-4 text-primary" />
            ) : (
              <Play className="ml-0.5 size-4 text-primary" />
            )}
          </div>
        </button>
      </div>
    </motion.div>
  );
}

