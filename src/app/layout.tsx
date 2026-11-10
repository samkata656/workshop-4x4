import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope, Sofia_Sans_Extra_Condensed } from "next/font/google";
import "./globals.css";

// All three families ship Cyrillic, which the Bulgarian UI needs.
const display = Sofia_Sans_Extra_Condensed({
  variable: "--font-display-face",
  subsets: ["latin", "cyrillic"],
});
const ui = Manrope({
  variable: "--font-ui-face",
  subsets: ["latin", "cyrillic"],
});
const mono = JetBrains_Mono({
  variable: "--font-mono-face",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: {
    default: "4×4 Сервиз — рамкови Toyota и Lexus GX/LX",
    template: "%s · 4×4 Сервиз",
  },
  description:
    "Обслужване, ремонти и модификации за рамкови Toyota и Lexus GX/LX: Land Cruiser, Prado, Hilux, 4Runner и други.",
};

export const viewport: Viewport = {
  themeColor: "#171c19",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg" className={`${display.variable} ${ui.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
