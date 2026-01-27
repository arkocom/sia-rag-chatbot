import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIA — Expert IA sur vos corpus documentaires",
  description:
    "Transformez vos corpus documentaires en agents IA experts consultables. Réponses sourcées, zéro hallucination.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={GeistSans.className}>{children}</body>
    </html>
  );
}
