"use client";

import { motion } from "framer-motion";
import { Sparkles, BookOpen } from "lucide-react";

const STAR_COUNT = 12;

export function LoadingScreen() {
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
      </motion.div>
    </div>
  );
}
