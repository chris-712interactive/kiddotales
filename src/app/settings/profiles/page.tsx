"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  UserPlus,
  Pencil,
  Trash2,
  Loader2,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthButtons } from "@/components/auth-buttons";
import { toast } from "sonner";
import { ProfileFormModal } from "@/components/profile-form-modal";
import type { ChildProfile } from "@/types";

export default function ChildProfilesPage() {
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalProfile, setModalProfile] = useState<ChildProfile | null | "new">(
    null
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchProfiles = () => {
    fetch("/api/child-profiles")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setProfiles(Array.isArray(data) ? data : []))
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleSave = async (
    data: Omit<ChildProfile, "id" | "createdAt" | "updatedAt">
  ) => {
    if (modalProfile === "new" || !modalProfile) {
      const res = await fetch("/api/child-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create");
      const profile = await res.json();
      setProfiles((prev) => [profile, ...prev]);
      toast.success(`Created profile for ${profile.name}`);
    } else {
      const res = await fetch(`/api/child-profiles/${modalProfile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      const profile = await res.json();
      setProfiles((prev) =>
        prev.map((p) => (p.id === profile.id ? profile : p))
      );
      toast.success(`Updated ${profile.name}`);
    }
  };

  const handleDelete = async (profileId: string) => {
    setDeletingId(profileId);
    try {
      const res = await fetch(`/api/child-profiles/${profileId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setProfiles((prev) => prev.filter((p) => p.id !== profileId));
        toast.success("Profile deleted");
      } else {
        toast.error("Could not delete profile");
      }
    } catch {
      toast.error("Could not delete profile");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)] dark:from-[var(--pastel-pink)] dark:via-background dark:to-[var(--pastel-mint)]">
      <header className="flex items-center justify-between px-4 py-4 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/branding/logo.svg"
            alt="KiddoTales"
            width={32}
            height={32}
            className="size-8 object-contain"
          />
          <span className="text-xl font-bold text-foreground">KiddoTales</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/settings">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 size-4" />
              Settings
            </Button>
          </Link>
          <AuthButtons />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Child profiles
            </h1>
            <p className="mt-1 text-muted-foreground">
              Create profiles to quickly prefill the book creation form. Each
              profile stores your child&apos;s name, age, interests, and more.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add a profile</CardTitle>
              <CardDescription>
                Create a child profile to save time when making books. You can
                select a profile on the create page to prefill the form.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setModalProfile("new")}>
                <UserPlus className="mr-2 size-4" />
                Add child profile
              </Button>
            </CardContent>
          </Card>

          {loading ? (
            <div className="flex justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Loading profiles…
            </div>
          ) : profiles.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <UserPlus className="mx-auto mb-4 size-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No child profiles yet. Create one to prefill the book form.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setModalProfile("new")}
                >
                  Add your first profile
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">
                Your profiles
              </h2>
              {profiles.map((profile) => (
                <Card key={profile.id} className="overflow-hidden">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/20 text-lg font-semibold text-primary">
                      {profile.name[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{profile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {profile.age} years · {profile.interests?.slice(0, 3).join(", ")}
                        {profile.interests?.length > 3 && "…"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Link href="/create">
                        <Button size="sm" variant="default" title="Create book with this profile">
                          <BookOpen className="size-4" />
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        title="Edit"
                        onClick={() => setModalProfile(profile)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={deletingId === profile.id}
                        title="Delete"
                        onClick={() => {
                          if (confirm(`Delete profile for ${profile.name}?`)) {
                            handleDelete(profile.id);
                          }
                        }}
                      >
                        {deletingId === profile.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </motion.div>
      </main>

      {modalProfile !== null && (
        <ProfileFormModal
          profile={modalProfile === "new" ? null : modalProfile}
          onClose={() => setModalProfile(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
