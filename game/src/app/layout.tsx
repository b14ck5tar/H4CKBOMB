import type { Metadata, Viewport } from "next";
import { Anton, Atkinson_Hyperlegible, Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import "./juice.css";
import "./quick.css";

// Urban-fantasy broadcast type stack. Variable names are the contract the components rely on.
// display: tabloid/broadcast headline. heading: chunky condensed lower-third. body: built for legibility
// across a room. ui: case-file mono for labels, numbers and chips.
const display = Anton({ variable: "--font-display", subsets: ["latin"], weight: ["400"] });
const heading = Barlow_Condensed({ variable: "--font-heading", subsets: ["latin"], weight: ["500", "600", "700", "800"] });
const body = Atkinson_Hyperlegible({ variable: "--font-body", subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"] });
const ui = IBM_Plex_Mono({ variable: "--font-ui", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Once Upon a Roll",
  description: "Nobody has to be the Dungeon Master anymore. A co-op fairytale party game where every quest is today's news.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0A0612",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${heading.variable} ${body.variable} ${ui.variable} antialiased`}>{children}</body>
    </html>
  );
}
