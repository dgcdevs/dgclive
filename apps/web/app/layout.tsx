import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DGC Live",
  description: "Experience God's Presence on Livestream",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Mux Player Web Component — needed for <mux-player> custom element */}
        <Script
          src="https://cdn.jsdelivr.net/npm/@mux/mux-player"
          type="module"
          strategy="beforeInteractive"
        />
      </head>
      <body
        className={`${inter.variable} antialiased bg-brand-bg text-white`}
      >
        {children}
      </body>
    </html>
  );
}
