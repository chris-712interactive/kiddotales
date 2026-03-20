"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, MessageSquare } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackTrigger } from "@/components/feedback-trigger";
import { FeedbackCategoryBadge } from "@/components/feedback-category-badge";
import { toast } from "sonner";

type FeedbackTicket = {
  id: string;
  category: string | null;
  status: "new" | "in_review" | "resolved";
  created_at: string;
  updated_at: string | null;
  unread_for_user: boolean;
};

type FeedbackMessage = {
  id: string;
  sender_role: "user" | "admin";
  sender_email: string | null;
  message: string;
  created_at: string;
};

export default function MessageCenterPage() {
  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [replySending, setReplySending] = useState(false);

  const loadTickets = () => {
    setTicketsLoading(true);
    fetch("/api/feedback")
      .then((r) => (r.ok ? r.json() : { tickets: [] }))
      .then((res) => setTickets((res.tickets ?? []) as FeedbackTicket[]))
      .catch(() => {})
      .finally(() => setTicketsLoading(false));
  };

  const loadTicketThread = async (ticketId: string) => {
    setMessagesLoading(true);
    setActiveTicketId(ticketId);
    try {
      const res = await fetch(`/api/feedback/${ticketId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to load conversation");
        return;
      }
      setMessages((data.messages ?? []) as FeedbackMessage[]);
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, unread_for_user: false } : t)));
    } catch {
      toast.error("Failed to load conversation");
    } finally {
      setMessagesLoading(false);
    }
  };

  const sendReply = async () => {
    if (!activeTicketId) return;
    const trimmed = replyDraft.trim();
    if (!trimmed) return;
    setReplySending(true);
    try {
      const res = await fetch(`/api/feedback/${activeTicketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to send reply");
        return;
      }
      setReplyDraft("");
      await loadTicketThread(activeTicketId);
      loadTickets();
      toast.success("Reply sent");
    } catch {
      toast.error("Failed to send reply");
    } finally {
      setReplySending(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)]">
      <AppHeader
        pageActions={
          <Link href="/settings">
            <Button variant="ghost" size="sm" className="size-9 px-2 sm:size-auto sm:px-3" aria-label="Back to settings">
              <ArrowLeft className="size-4 sm:mr-1" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </Link>
        }
      />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-4 md:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
          <section className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Message Center</h1>
              <p className="text-muted-foreground">View all feedback tickets and chat with support in one place.</p>
            </div>
            <FeedbackTrigger variant="button" />
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="size-5" />
                Your tickets
              </CardTitle>
              <CardDescription>Open a ticket to read replies or send updates.</CardDescription>
            </CardHeader>
            <CardContent>
              {ticketsLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading tickets…
                </div>
              ) : tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tickets yet. Use “Send feedback” to create one.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    {tickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        type="button"
                        onClick={() => loadTicketThread(ticket.id)}
                        className={`w-full rounded-lg border p-3 text-left transition-colors ${
                          activeTicketId === ticket.id
                            ? "border-primary bg-primary/5"
                            : "border-border bg-muted/10 hover:bg-muted/20"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <FeedbackCategoryBadge category={ticket.category} />
                          <span className="text-xs text-muted-foreground">{ticket.status.replace("_", " ")}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date(ticket.updated_at ?? ticket.created_at).toLocaleString()}
                          </span>
                          {ticket.unread_for_user ? (
                            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] text-primary">New reply</span>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="rounded-lg border border-border bg-muted/10 p-3">
                    {!activeTicketId ? (
                      <p className="text-sm text-muted-foreground">Select a ticket to view conversation.</p>
                    ) : messagesLoading ? (
                      <p className="text-sm text-muted-foreground">Loading conversation…</p>
                    ) : (
                      <>
                        <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                          {messages.map((m) => (
                            <div key={m.id} className={`rounded-md p-2 text-sm ${m.sender_role === "admin" ? "bg-primary/10" : "bg-card"}`}>
                              <div className="mb-1 text-[11px] text-muted-foreground">
                                {m.sender_role === "admin" ? "Support" : "You"} - {new Date(m.created_at).toLocaleString()}
                              </div>
                              <p className="whitespace-pre-wrap">{m.message}</p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 space-y-2">
                          <textarea
                            value={replyDraft}
                            onChange={(e) => setReplyDraft(e.target.value)}
                            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                            rows={4}
                            placeholder="Reply to support…"
                          />
                          <Button onClick={sendReply} disabled={replySending}>
                            {replySending ? "Sending…" : "Send reply"}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
