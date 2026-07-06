import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Dusty Workstation", description: "A retro browser beatmaker MVP" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
