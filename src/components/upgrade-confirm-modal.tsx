"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  tierName: string;
  amountFormatted: string;
  /** When true, proration is waived (small charge); no immediate payment. */
  prorationWaived?: boolean;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
};

export function UpgradeConfirmModal({
  isOpen,
  onClose,
  tierName,
  amountFormatted,
  prorationWaived = false,
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:items-center sm:p-4 sm:pb-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[min(92dvh,calc(100vh-1.5rem))] w-full max-w-md overflow-y-auto overscroll-y-contain rounded-2xl border-2 border-border bg-card p-4 shadow-xl sm:max-h-[90dvh] sm:p-6"
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
              {prorationWaived ? (
                <>
                  Your upgrade takes effect right away. Because the prorated
                  amount would be small, we won&apos;t charge you today — you keep
                  the same renewal date, and your next bill reflects the new plan.
                </>
              ) : (
                <>
                  You&apos;ll be charged a prorated amount for the remainder of
                  your current billing period. Your renewal date stays the same.
                </>
              )}
            </p>

            <div className="mb-6 rounded-xl border-2 border-border bg-muted/50 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                {prorationWaived ? "Due now" : "Charge today"}
              </p>
              <p className="text-2xl font-bold text-foreground">
                {amountFormatted}
              </p>
              {prorationWaived && (
                <p className="mt-2 text-xs text-muted-foreground">
                  No payment is collected for this upgrade right now.
                </p>
              )}
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
