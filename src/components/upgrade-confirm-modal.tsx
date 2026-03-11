"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  tierName: string;
  amountFormatted: string;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
};

export function UpgradeConfirmModal({
  isOpen,
  onClose,
  tierName,
  amountFormatted,
  onConfirm,
  isLoading = false,
}: Props) {
  const handleConfirm = async () => {
    try {
      await onConfirm();
      onClose();
    } catch {
      // Error handled by caller
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="w-full max-w-md rounded-2xl border-2 border-border bg-card p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upgrade-modal-title"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-primary" aria-hidden />
                <h2 id="upgrade-modal-title" className="text-xl font-semibold text-foreground">
                  Upgrade to {tierName}
                </h2>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                <X className="size-5" />
              </Button>
            </div>

            <p className="mb-4 text-muted-foreground">
              You&apos;ll be charged a prorated amount for the remainder of your
              current billing period.
            </p>

            <div className="mb-6 rounded-xl border-2 border-border bg-muted/50 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Charge today
              </p>
              <p className="text-2xl font-bold text-foreground">
                {amountFormatted}
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirm}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Confirm upgrade"
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
