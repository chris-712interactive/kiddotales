"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, BookOpen, Check, Loader2 } from "lucide-react";

const STAR_COUNT = 12;

const BASE_GENERATION_STEPS = [
  "Generating your story",
  "Creating the cover image",
  "Illustrating page 1",
  "Illustrating page 2",
  "Illustrating page 3",
  "Illustrating page 4",
  "Illustrating page 5",
  "Illustrating page 6",
  "Illustrating page 7",
  "Illustrating page 8",
  "Finishing up",
];

const AI_VOICE_STEPS = [
  "Adding AI voice to page 1",
  "Adding AI voice to page 2",
  "Adding AI voice to page 3",
  "Adding AI voice to page 4",
  "Adding AI voice to page 5",
  "Adding AI voice to page 6",
  "Adding AI voice to page 7",
  "Adding AI voice to page 8",
];

const STEP_INTERVAL_MS = 15_000;

export function LoadingScreen({
  showSteps = false,
  hasAiVoice = false,
}: {
  showSteps?: boolean;
  hasAiVoice?: boolean;
}) {
  const GENERATION_STEPS =
    hasAiVoice
      ? [
          ...BASE_GENERATION_STEPS.slice(0, -1),
          ...AI_VOICE_STEPS,
          BASE_GENERATION_STEPS[BASE_GENERATION_STEPS.length - 1],
        ]
      : BASE_GENERATION_STEPS;
  const [completedSteps, setCompletedSteps] = useState(0);
  const [startTime] = useState(() => Date.now());

  useEffect(() => {
    if (!showSteps) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const step = Math.min(
        Math.floor(elapsed / STEP_INTERVAL_MS),
        GENERATION_STEPS.length
      );
      setCompletedSteps(step);
    }, 2000);
    return () => clearInterval(interval);
  }, [showSteps, startTime]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[var(--pastel-pink)] via-[var(--pastel-blue)] to-[var(--pastel-mint)] dark:from-[var(--pastel-pink)] dark:via-[var(--pastel-blue)] dark:to-[var(--pastel-mint)]">
      {/* Sparkling stars */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: STAR_COUNT }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-yellow-400 dark:text-yellow-300"
            style={{
              left: `${(i * 7 + 5) % 100}%`,
              top: `${(i * 11 + 10) % 100}%`,
            }}
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.1,
            }}
          >
            <Sparkles className="size-6" />
          </motion.div>
        ))}
      </div>

      {/* Flying books */}
      <motion.div
        className="absolute left-[15%] top-[20%] text-primary/40"
        animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <BookOpen className="size-12" />
      </motion.div>
      <motion.div
        className="absolute right-[20%] top-[30%] text-primary/30"
        animate={{ y: [0, 10, 0], rotate: [0, -5, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      >
        <BookOpen className="size-10" />
      </motion.div>
      <motion.div
        className="absolute bottom-[25%] left-[25%] text-primary/20"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      >
        <BookOpen className="size-8" />
      </motion.div>

      {/* Main content */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <BookOpen className="size-20 loading-book-icon" />
        </motion.div>
        <p className="text-center text-xl font-semibold text-foreground md:text-2xl">
          Weaving your magic story...
        </p>
        {showSteps ? (
          <div className="w-full max-w-sm max-h-[50vh] overflow-y-auto space-y-2 creation-steps-container creation-steps-container-light dark:creation-steps-container-dark">
            {GENERATION_STEPS.map((step, i) => (
              <div
                key={step}
                className="flex items-center gap-3 text-sm"
              >
                <div
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                    i < completedSteps
                      ? "bg-primary text-primary-foreground"
                      : i === completedSteps
                        ? "border-2 border-primary bg-primary/20 text-primary"
                        : "border-2 border-muted-foreground/30 text-muted-foreground"
                  }`}
                >
                  {i < completedSteps ? (
                    <Check className="size-3.5" />
                  ) : i === completedSteps ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <span className="text-xs font-medium">{i + 1}</span>
                  )}
                </div>
                <span
                  className={
                    i <= completedSteps
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }
                >
                  {step}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <motion.div
            className="h-2 w-48 overflow-hidden rounded-full bg-primary/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <motion.div
              className="h-full w-1/3 rounded-full bg-primary"
              animate={{ x: ["0%", "200%"] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
