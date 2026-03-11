import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import "@/styles/custom.scss";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeSync } from "@/components/theme-sync";
import { AuthSessionProvider } from "@/components/session-provider";
import { Footer } from "@/components/footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KiddoTales - Turn 60 seconds into bedtime magic",
  description:
    "Create personalized AI-powered storybooks for your child in minutes. Custom stories with their name, interests, and life lessons.",
  keywords: ["children", "storybook", "bedtime", "AI", "personalized", "kids"],
  authors: [{ name: "KiddoTales" }],
  openGraph: {
    title: "KiddoTales - Turn 60 seconds into bedtime magic",
    description: "Create personalized AI-powered storybooks for your child",
    type: "website",
  },
  icons: {
    icon: "/favicon.ico",
  },
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
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
