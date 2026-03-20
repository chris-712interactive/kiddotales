"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackCategoryBadge } from "@/components/feedback-category-badge";
import { AppHeader } from "@/components/app-header";

type FeedbackStatus = "new" | "in_review" | "resolved";

type AdminFeedback = {
  id: string;
  user_id: string | null;
  email: string | null;
  message: string;
  category: string | null;
  status: FeedbackStatus;
  unread_for_user?: boolean;
  unread_for_admin?: boolean;
  created_at: string;
  updated_at: string | null;
};

type FeedbackMessage = {
  id: string;
  sender_role: "user" | "admin";
  sender_email: string | null;
  message: string;
  created_at: string;
};

export default function AdminFeedbackPage() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<AdminFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | FeedbackStatus>("all");

  const loadFeedback = () => {
    setLoading(true);
    fetch("/api/admin/feedback")
      .then((res) => {
        if (res.status === 401) {
          router.replace("/sign-in?callbackUrl=/admin/feedback");
          return null;
        }
        if (res.status === 403) {
          setError("Access denied.");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        const rows = (data.feedback ?? []) as AdminFeedback[];
        setFeedback(rows);
      })
      .catch(() => setError("Failed to load feedback"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadFeedback();
  }, []);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return feedback;
    return feedback.filter((f) => f.status === statusFilter);
  }, [feedback, statusFilter]);

  const openTicket = (id: string) => {
    setActiveTicketId(id);
    setMessagesLoading(true);
    fetch(`/api/admin/feedback/${id}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data?.error ?? "Failed to load conversation");
          return;
        }
        setMessages((data.messages ?? []) as FeedbackMessage[]);
        setFeedback((prev) => prev.map((item) => (item.id === id ? { ...item, unread_for_admin: false } : item)));
      })
      .catch(() => toast.error("Failed to load conversation"))
      .finally(() => setMessagesLoading(false));
  };

  const saveStatus = (id: string, status: FeedbackStatus) => {
    setSavingStatusId(id);
    fetch("/api/admin/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data?.error ?? "Failed to save status");
          return;
        }
        setFeedback((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
        toast.success("Status updated");
      })
      .catch(() => toast.error("Failed to save status"))
      .finally(() => setSavingStatusId(null));
  };

  const sendReply = () => {
    if (!activeTicketId) return;
    const trimmed = replyDraft.trim();
    if (!trimmed) return;
    setSendingReply(true);
    const active = feedback.find((f) => f.id === activeTicketId);
    fetch(`/api/admin/feedback/${activeTicketId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: trimmed, status: active?.status }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data?.error ?? "Failed to send reply");
          return;
        }
        setReplyDraft("");
        toast.success("Reply sent");
        openTicket(activeTicketId);
        loadFeedback();
      })
      .catch(() => toast.error("Failed to send reply"))
      .finally(() => setSendingReply(false));
  };

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)] px-4">
        <Shield className="size-16 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-bold text-foreground">Access denied</h1>
        <p className="mt-2 text-muted-foreground">{error}</p>
        <Link href="/admin" className="mt-6">
          <Button>Back to Admin</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)]">
      <AppHeader
        pageActions={
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="size-9 px-2 sm:size-auto sm:px-3" aria-label="Back to admin">
              <ArrowLeft className="size-4 sm:mr-1" />
              <span className="hidden sm:inline">Admin</span>
            </Button>
          </Link>
        }
      />

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-6"
        >
          <section className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Manage Feedback</h1>
              <p className="text-muted-foreground">
                Review customer feedback, track status, and draft responses for follow-up.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="status-filter" className="text-sm text-muted-foreground">
                Filter
              </label>
              <select
                id="status-filter"
                className="rounded-md border border-border bg-card px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | FeedbackStatus)}
              >
                <option value="all">All</option>
                <option value="new">New</option>
                <option value="in_review">In review</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Feedback inbox</CardTitle>
              <CardDescription>{filtered.length} item(s) shown</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No feedback found for this filter.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    {filtered.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openTicket(item.id)}
                        className={`w-full rounded-xl border p-3 text-left transition-colors ${
                          activeTicketId === item.id
                            ? "border-primary bg-primary/5"
                            : "border-border bg-muted/10 hover:bg-muted/20"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground">{item.email ?? "No email"}</span>
                          {item.unread_for_admin ? (
                            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] text-primary">New</span>
                          ) : null}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <FeedbackCategoryBadge category={item.category} />
                          <span>{new Date(item.updated_at ?? item.created_at).toLocaleString()}</span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm">{item.message}</p>
                      </button>
                    ))}
                  </div>
                  <div className="rounded-xl border border-border bg-muted/10 p-4">
                    {!activeTicketId ? (
                      <p className="text-sm text-muted-foreground">Select a ticket to open the conversation.</p>
                    ) : messagesLoading ? (
                      <p className="text-sm text-muted-foreground">Loading conversation…</p>
                    ) : (
                      <>
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <select
                            className="rounded-md border border-border bg-card px-2 py-1 text-sm"
                            value={feedback.find((f) => f.id === activeTicketId)?.status ?? "new"}
                            onChange={(e) => saveStatus(activeTicketId, e.target.value as FeedbackStatus)}
                            disabled={savingStatusId === activeTicketId}
                          >
                            <option value="new">New</option>
                            <option value="in_review">In review</option>
                            <option value="resolved">Resolved</option>
                          </select>
                          {savingStatusId === activeTicketId ? (
                            <span className="text-xs text-muted-foreground">Saving status…</span>
                          ) : null}
                        </div>
                        <div className="max-h-72 space-y-2 overflow-y-auto">
                          {messages.map((m) => (
                            <div
                              key={m.id}
                              className={`rounded-md p-2 text-sm ${
                                m.sender_role === "admin" ? "bg-primary/10" : "bg-card"
                              }`}
                            >
                              <div className="mb-1 text-[11px] text-muted-foreground">
                                {m.sender_role === "admin" ? "Admin" : "User"} - {new Date(m.created_at).toLocaleString()}
                              </div>
                              <p className="whitespace-pre-wrap">{m.message}</p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 space-y-2">
                          <textarea
                            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                            rows={4}
                            value={replyDraft}
                            onChange={(e) => setReplyDraft(e.target.value)}
                            placeholder="Type your reply…"
                          />
                          <Button onClick={sendReply} disabled={sendingReply}>
                            {sendingReply ? "Sending…" : "Send reply"}
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
