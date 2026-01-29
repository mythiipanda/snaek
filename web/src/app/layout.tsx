import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Snaek's Value List",
  description: "Counter Blox skin values, search, and trade calculator.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-dvh bg-background text-foreground antialiased`}
      >
        <div className="min-h-dvh">
          <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
            <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
              <Link href="/" className="font-semibold tracking-tight">
                Snaek&apos;s Value List
              </Link>
              <nav className="flex items-center gap-4 text-sm text-muted-foreground">
                <Link
                  href="/skins"
                  className="hover:text-foreground transition-colors"
                >
                  Skins
                </Link>
                <Link
                  href="/trade"
                  className="hover:text-foreground transition-colors"
                >
                  Trade calculator
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
