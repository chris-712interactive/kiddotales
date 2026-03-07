import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

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
        <ThemeProvider defaultTheme="light" storageKey="kiddotales-theme">
          {children}
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
      </body>
    </html>
  );
}
