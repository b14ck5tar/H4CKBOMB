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
  title: "Group Project",
  description: "A party game where Meta's Muse is the Dungeon Master, your phones are the controllers, and every story starts from something that really happened.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
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
