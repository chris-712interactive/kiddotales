"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackModal } from "./feedback-modal";

type Props = {
  variant?: "link" | "button";
  className?: string;
};

export function FeedbackTrigger({ variant = "link", className }: Props) {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const userEmail = session?.user?.email ?? null;

  if (variant === "button") {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className={className}
        >
          <MessageSquare className="mr-1 size-4" />
          Send feedback
        </Button>
        <FeedbackModal
          isOpen={open}
          onClose={() => setOpen(false)}
          userEmail={userEmail}
        />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`underline hover:text-foreground ${className ?? ""}`}
      >
        Feedback
      </button>
      <FeedbackModal
        isOpen={open}
        onClose={() => setOpen(false)}
        userEmail={userEmail}
      />
    </>
  );
}
