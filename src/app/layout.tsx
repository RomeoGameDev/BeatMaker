import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Workstation Music", description: "A browser music workstation, sampler, and sequencer" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
