"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Shield,
  Trash2,
  ChevronLeft,
  ChevronRight,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { AppHeader } from "@/components/app-header";
import { toast } from "sonner";
import { SUBSCRIPTION_TIERS } from "@/lib/stripe";

type AdminUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  subscriptionTier: string;
  stripeSubscriptionStatus: string | null;
  createdAt: string;
  bookCount: number;
};

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  spark: "Spark",
  magic: "Magic",
  legend: "Legend",
};

export default function AdminUsersPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id;
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadUsers = (p = page) => {
    setLoading(true);
    fetch(`/api/admin/users?page=${p}&limit=${limit}`)
      .then((res) => {
        if (res.status === 401) {
          router.replace("/sign-in?callbackUrl=/admin/users");
          return null;
        }
        if (res.status === 403) {
          setError("Access denied.");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setUsers(data.users ?? []);
          setTotal(data.total ?? 0);
        }
      })
      .catch(() => setError("Failed to load users"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers(page);
  }, [page]);

  const isPaidTier = (tier: string) => tier === "spark" || tier === "magic" || tier === "legend";

  const handleTierChange = (userId: string, newTier: string) => {
    setUpdating(userId);
    fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionTier: newTier }),
    })
      .then(async (res) => {
        const data = res.ok ? null : await res.json().catch(() => ({}));
        if (res.ok) {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === userId
                ? {
                    ...u,
                    subscriptionTier: newTier,
                    stripeSubscriptionStatus: newTier === "free" ? null : u.stripeSubscriptionStatus,
                  }
                : u
            )
          );
          toast.success(newTier === "free" ? "Subscription cancelled" : "Subscription updated");
        } else {
          toast.error(data?.error ?? "Failed to update subscription");
        }
      })
      .catch(() => toast.error("Failed to update subscription"))
      .finally(() => setUpdating(null));
  };

  const handleDelete = (userId: string) => {
    if (deleteConfirm !== userId) {
      setDeleteConfirm(userId);
      return;
    }
    setDeleting(userId);
    fetch(`/api/admin/users/${userId}`, { method: "DELETE" })
      .then((res) => {
        if (res.ok) {
          setUsers((prev) => prev.filter((u) => u.id !== userId));
          setTotal((t) => Math.max(0, t - 1));
          setDeleteConfirm(null);
          toast.success("User and all associated data deleted");
        } else {
          toast.error("Failed to delete user");
        }
      })
      .catch(() => toast.error("Failed to delete user"))
      .finally(() => {
        setDeleting(null);
      });
  };

  const totalPages = Math.ceil(total / limit);

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

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          <section>
            <h1 className="text-2xl font-bold text-foreground">Manage Users</h1>
            <p className="text-muted-foreground">
              View users, grant tiers (free users), cancel paid subscriptions, or delete accounts. Admins cannot change paid plans—users do that in Settings. Deleting removes all books, profiles, and related data.
            </p>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                {total} total · Page {page} of {totalPages || 1}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              ) : users.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No users found.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="pb-3 pr-4 font-medium">Email</th>
                          <th className="pb-3 pr-4 font-medium">Name</th>
                          <th className="pb-3 pr-4 font-medium">Tier</th>
                          <th className="pb-3 pr-4 font-medium">Books</th>
                          <th className="pb-3 pr-4 font-medium">Joined</th>
                          <th className="pb-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u.id} className="border-b border-border/50">
                            <td className="py-3 pr-4">
                              <span className="font-mono text-sm">
                                {u.email || <span className="text-muted-foreground">—</span>}
                              </span>
                            </td>
                            <td className="py-3 pr-4">
                              {u.displayName || <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="py-3 pr-4">
                              {isPaidTier(u.subscriptionTier) ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">
                                    {TIER_LABELS[u.subscriptionTier] ?? u.subscriptionTier}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleTierChange(u.id, "free")}
                                    disabled={updating === u.id}
                                    className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    title="Cancel subscription"
                                  >
                                    {updating === u.id ? (
                                      <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                      <>
                                        <XCircle className="mr-1 size-4" />
                                        Cancel
                                      </>
                                    )}
                                  </Button>
                                </div>
                              ) : (
                                <Select
                                  value={u.subscriptionTier}
                                  onChange={(e) => handleTierChange(u.id, e.target.value)}
                                  disabled={updating === u.id}
                                  className="h-9 w-32 text-sm"
                                  title="Grant a paid tier (admin)"
                                >
                                  {Object.keys(SUBSCRIPTION_TIERS).map((tier) => (
                                    <option key={tier} value={tier}>
                                      {TIER_LABELS[tier] ?? tier}
                                    </option>
                                  ))}
                                </Select>
                              )}
                            </td>
                            <td className="py-3 pr-4">{u.bookCount}</td>
                            <td className="py-3 pr-4 text-sm text-muted-foreground">
                              {new Date(u.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(u.id)}
                                disabled={deleting === u.id || u.id === currentUserId}
                                title={u.id === currentUserId ? "Cannot delete your own account" : undefined}
                                aria-label={`Delete ${u.email ?? u.id}`}
                              >
                                {deleting === u.id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : deleteConfirm === u.id ? (
                                  "Confirm?"
                                ) : (
                                  <Trash2 className="size-4" />
                                )}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                      >
                        <ChevronLeft className="size-4" />
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                      >
                        Next
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
