import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "sonner";
import "./globals.css";
import "@/styles/custom.scss";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeSync } from "@/components/theme-sync";
import { AuthSessionProvider } from "@/components/session-provider";
import { Footer } from "@/components/footer";
import { GoogleAnalytics } from "@/components/google-analytics";
import { AffiliateRefCapture } from "@/components/affiliate-ref-capture";
import { AffiliateAttribution } from "@/components/affiliate-attribution";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "KiddoTales - Personalized AI Bedtime Stories (AI Voice + Print-Ready PDFs)",
  description:
    "Create personalized AI bedtime stories for kids (ages 3–10) in minutes. Includes AI illustrations, optional AI voice read-aloud, and print-ready PDF storybooks.",
  keywords: [
    "kiddo tales",
    "bedtime stories",
    "personalized stories",
    "AI storybooks",
    "AI voice read aloud",
    "print-ready PDF",
    "children 3-10",
  ],
  authors: [{ name: "KiddoTales" }],
  openGraph: {
    title: "KiddoTales - Personalized AI Bedtime Stories",
    description:
      "Personalized AI bedtime stories with optional AI voice read-aloud and print-ready PDFs.",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "KiddoTales - Turn 60 seconds into bedtime magic",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [
      { url: "/favicon/favicon.ico", sizes: "any" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/favicon/apple-touch-icon.png",
  },
  manifest: "/favicon/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthSessionProvider>
          <ThemeProvider defaultTheme="light" storageKey="kiddotales-theme">
            <ThemeSync />
            <Suspense fallback={null}>
              <AffiliateRefCapture />
              <AffiliateAttribution />
            </Suspense>
            <a href="#main" className="sr-only skip-link">
              Skip to main content
            </a>
            <div className="flex min-h-screen flex-col">
              <main id="main" className="flex-1">{children}</main>
              <Footer />
            </div>
          <Toaster
            position="top-center"
            richColors
            closeButton
            toastOptions={{
              style: {
                borderRadius: "1rem",
                border: "2px solid var(--border)",
              },
            }}
          />
          <Analytics />
          <GoogleAnalytics />
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
