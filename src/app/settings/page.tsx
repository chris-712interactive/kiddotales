"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, User, Phone, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";

type SettingsData = {
  profile: {
    id: string;
    email: string | null;
    displayName: string | null;
    phone: string | null;
    subscriptionTier: string;
    theme?: "light" | "dark";
    name: string | null;
    image: string | null;
  };
  bookCount: number;
  bookLimit: number;
  subscriptionTier: string;
  theme?: "light" | "dark";
};

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((res) => {
        setData(res);
        setDisplayName(res.profile?.displayName ?? "");
        setPhone(res.profile?.phone ?? "");
      })
      .catch(() => toast.error("Could not load settings"))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          phone: phone.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const json = await res.json();
      setData((prev) =>
        prev
          ? {
              ...prev,
              profile: { ...prev.profile, ...json.profile },
            }
          : prev
      );
      toast.success("Contact info saved");
    } catch {
      toast.error("Could not save contact info");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
          <ThemeToggle />
        </header>
        <main className="mx-auto max-w-2xl px-4 py-12">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Sparkles className="size-5 animate-pulse" />
            Loading settings…
          </div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)]">
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
          <ThemeToggle />
        </header>
        <main className="mx-auto max-w-2xl px-4 py-12 text-center">
          <p className="text-muted-foreground">Could not load settings.</p>
          <Link href="/">
            <Button variant="outline" className="mt-4">
              Back to home
            </Button>
          </Link>
        </main>
      </div>
    );
  }

  const { profile, bookCount, bookLimit, subscriptionTier } = data;

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
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 size-4" />
              Home
            </Button>
          </Link>
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
          <h1 className="text-3xl font-bold text-foreground">Account settings</h1>

          {/* Profile info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="size-5" />
                Profile
              </CardTitle>
              <CardDescription>Your account information from Google</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4">
                {profile.image ? (
                  <img
                    src={profile.image}
                    alt=""
                    className="size-16 rounded-full border-2 border-border object-cover"
                  />
                ) : (
                  <div className="flex size-16 items-center justify-center rounded-full border-2 border-border bg-muted">
                    <User className="size-8 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-semibold">
                    {profile.name || profile.displayName || "No name"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {profile.email || "No email"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Theme:{" "}
                    <span className="capitalize">
                      {data.theme ?? profile.theme ?? "light"}
                    </span>{" "}
                    (toggle in header)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="size-5" />
                Contact information
              </CardTitle>
              <CardDescription>
                Optional. Add a display name or phone number if you&apos;d like.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveContact} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display name</Label>
                  <Input
                    id="displayName"
                    placeholder="e.g. Sarah"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="e.g. +1 555 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save contact info"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Subscription & book limit */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="size-5" />
                Subscription & usage
              </CardTitle>
              <CardDescription>
                Your current plan and book creation limit
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border-2 border-border bg-muted/50 px-4 py-3">
                <span className="font-medium">Plan</span>
                <span className="rounded-full bg-primary/20 px-3 py-1 text-sm font-medium capitalize text-primary">
                  {subscriptionTier}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border-2 border-border bg-muted/50 px-4 py-3">
                <span className="font-medium">Books created</span>
                <span className="text-muted-foreground">
                  {bookCount} / {bookLimit}
                </span>
              </div>
              {bookCount >= bookLimit && (
                <p className="text-sm text-muted-foreground">
                  You&apos;ve reached your book limit. Upgrade your plan for more
                  stories!
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
