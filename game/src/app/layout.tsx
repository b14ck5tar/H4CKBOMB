import type { Metadata, Viewport } from "next";
import { Alegreya_Sans, Cinzel, Cinzel_Decorative, EB_Garamond } from "next/font/google";
import "./globals.css";
import "./juice.css";

const display = Cinzel_Decorative({ variable: "--font-display", subsets: ["latin"], weight: ["700", "900"] });
const heading = Cinzel({ variable: "--font-heading", subsets: ["latin"], weight: ["500", "700", "900"] });
const body = EB_Garamond({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"] });
const ui = Alegreya_Sans({ variable: "--font-ui", subsets: ["latin"], weight: ["400", "500", "700", "800"] });

export const metadata: Metadata = {
  title: "Once Upon a Roll",
  description: "Nobody has to be the Dungeon Master anymore. A co-op fairytale party game where every quest is today's news.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#161B33",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${heading.variable} ${body.variable} ${ui.variable} antialiased`}>{children}</body>
    </html>
  );
}
