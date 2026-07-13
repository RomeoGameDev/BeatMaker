"use client";

import { ReactNode } from "react";

export type WindowPanelState = "normal" | "minimized" | "maximized";

type Props = { title: string; children: ReactNode; state?: WindowPanelState; onStateChange?: (state: WindowPanelState) => void; className?: string; toolbar?: ReactNode };

export default function WindowPanel({ title, children, className = "", toolbar }: Props) {
  return (
    <section className={`window-panel ${className}`}>
      <div className="window-titlebar"><h2>{title}</h2>{toolbar && <div className="window-toolbar">{toolbar}</div>}</div>
      <div className="window-content">{children}</div>
    </section>
  );
}
