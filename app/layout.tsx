import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Libre_Caslon_Text } from "next/font/google";
import { Suspense } from "react";
import { SavedSync } from "@/components/account/saved-sync";
import { SiteNav, SiteNavShell } from "@/components/ui/site-nav";
import { StorageNotice } from "@/components/ui/storage-notice";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

const ui = Geist({
  variable: "--font-ui",
  subsets: ["latin"],
});

const book = Libre_Caslon_Text({
  variable: "--font-book",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "Marginalia · Pride and Prejudice with a guide in the margin",
    template: "%s · Marginalia",
  },
  description:
    "Read Pride and Prejudice with notes on the words and customs of 1813. Save words to a notebook that follows you to any device.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${ui.variable} ${book.variable} antialiased`}>
      <body className="min-h-dvh bg-paper font-sans text-ink">
        <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
          <SavedSync />
          <a
            href="#main"
            className="sr-only rounded-md bg-ink px-4 py-2 text-surface focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
          >
            Skip to content
          </a>
          <Suspense fallback={<SiteNavShell />}>
            <SiteNav />
          </Suspense>
          <StorageNotice />
          <main id="main" tabIndex={-1} className="outline-none">
            {children}
          </main>
          <Toaster />
        </ClerkProvider>
      </body>
    </html>
  );
}
