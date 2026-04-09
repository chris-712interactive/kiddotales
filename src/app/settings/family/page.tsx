"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Users,
  Trash2,
  Mail,
  UserMinus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AppHeader } from "@/components/app-header";
import { toast } from "sonner";
import { getTierCapabilities } from "@/lib/entitlements";

type FamilySharing = {
  role: "owner" | "member" | null;
  seatsTotal: number;
  seatsUsed: number;
  members: { memberUserId: string; email: string | null }[];
  pendingInvites: { id: string; invitedEmail: string; expiresAt: string }[];
  ownerEmail?: string | null;
};

export default function FamilySharingSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [familySharing, setFamilySharing] = useState<FamilySharing | null>(null);
  const [accountTier, setAccountTier] = useState<string>("free");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  const load = () => {
    fetch("/api/user/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.familySharing) setFamilySharing(data.familySharing);
        if (typeof data?.accountSubscriptionTier === "string") {
          setAccountTier(data.accountSubscriptionTier);
        }
      })
      .catch(() => setFamilySharing(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const sendInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) {
      toast.error("Enter an email address.");
      return;
    }
    setInviteLoading(true);
    try {
      const res = await fetch("/api/family-sharing/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success(
        data.emailSent
          ? "Invite sent by email. They can also use the link below."
          : "Invite created. Copy the link — email was not sent (configure Mailgun for email)."
      );
      if (data.acceptUrl) {
        await navigator.clipboard.writeText(data.acceptUrl);
        toast.message("Invite link copied to clipboard.");
      }
      setInviteEmail("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send invite");
    } finally {
      setInviteLoading(false);
    }
  };

  const cancelInvite = async (id: string) => {
    const res = await fetch(`/api/family-sharing/invites/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Could not cancel invite");
      return;
    }
    toast.success("Invite cancelled");
    load();
  };

  const removeMember = async (memberUserId: string) => {
    if (!confirm("Remove this person from your family plan?")) return;
    const res = await fetch("/api/family-sharing/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberUserId }),
    });
    if (!res.ok) {
      toast.error("Could not remove member");
      return;
    }
    toast.success("Member removed");
    load();
  };

  const showPage =
    familySharing?.role === "owner" || familySharing?.role === "member";
  const legendAccount = getTierCapabilities(accountTier).sharingSeats > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)] dark:from-[var(--pastel-pink)] dark:via-background dark:to-[var(--pastel-mint)]">
      <AppHeader
        pageActions={
          <Link href="/settings">
            <Button variant="ghost" size="sm" className="size-9 px-2 sm:size-auto sm:px-3" aria-label="Settings">
              <ArrowLeft className="size-4 sm:mr-1" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </Link>
        }
      />

      <main className="mx-auto w-full min-h-0 max-w-2xl flex-1 overflow-y-auto px-4 pb-16 pt-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Family sharing
            </h1>
            <p className="mt-1 text-muted-foreground">
              Legend plans can invite up to{" "}
              {getTierCapabilities("legend").sharingSeats} other parents or
              guardians. They sign in with their own Google account and share
              your story limits and plan features.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Loading…
            </div>
          ) : !showPage ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <Users className="size-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {legendAccount
                    ? "Something went wrong loading family sharing. Try refreshing the page."
                    : "Upgrade to Legend on the Subscription tab to invite family members."}
                </p>
                <Link href="/pricing">
                  <Button variant="default">View plans</Button>
                </Link>
              </CardContent>
            </Card>
          ) : familySharing?.role === "member" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your family plan</CardTitle>
                <CardDescription>
                  You&apos;re using a shared Legend plan. Your books count toward
                  the subscriber&apos;s monthly story limit.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Subscriber account:{" "}
                  <span className="font-medium text-foreground">
                    {familySharing.ownerEmail ?? "Unknown"}
                  </span>
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Invite someone</CardTitle>
                  <CardDescription>
                    {familySharing.seatsUsed} of {familySharing.seatsTotal}{" "}
                    seats used (active members + pending invites).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      type="email"
                      placeholder="Email address"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={() => void sendInvite()}
                      disabled={
                        inviteLoading ||
                        familySharing.seatsUsed >= familySharing.seatsTotal
                      }
                    >
                      {inviteLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <>
                          <Mail className="mr-2 size-4" />
                          Send invite
                        </>
                      )}
                    </Button>
                  </div>
                  {familySharing.seatsUsed >= familySharing.seatsTotal && (
                    <p className="text-sm text-muted-foreground">
                      Remove a member or cancel a pending invite to free a seat.
                    </p>
                  )}
                </CardContent>
              </Card>

              {familySharing.pendingInvites.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold">Pending invites</h2>
                  {familySharing.pendingInvites.map((inv) => (
                    <Card key={inv.id}>
                      <CardContent className="flex flex-wrap items-center justify-between gap-2 py-4">
                        <div>
                          <p className="font-medium">{inv.invitedEmail}</p>
                          <p className="text-xs text-muted-foreground">
                            Expires{" "}
                            {new Date(inv.expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void cancelInvite(inv.id)}
                        >
                          <Trash2 className="mr-1 size-4" />
                          Cancel
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {familySharing.members.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold">Members</h2>
                  {familySharing.members.map((m) => (
                    <Card key={m.memberUserId}>
                      <CardContent className="flex flex-wrap items-center justify-between gap-2 py-4">
                        <p className="font-medium">
                          {m.email ?? m.memberUserId.slice(0, 8) + "…"}
                        </p>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => void removeMember(m.memberUserId)}
                        >
                          <UserMinus className="mr-1 size-4" />
                          Remove
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}
