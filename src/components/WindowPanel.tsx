"use client";

import { ReactNode } from "react";

export type WindowPanelState = "normal" | "minimized" | "maximized";

type Props = {
  title: string;
  children: ReactNode;
  state: WindowPanelState;
  onStateChange: (state: WindowPanelState) => void;
  className?: string;
  toolbar?: ReactNode;
};

export default function WindowPanel({ title, children, state, onStateChange, className = "", toolbar }: Props) {
  const isMinimized = state === "minimized";
  const isMaximized = state === "maximized";

  return (
    <section className={`window-panel ${className} ${isMinimized ? "is-minimized" : ""} ${isMaximized ? "is-maximized" : ""}`}>
      <div className="window-titlebar">
        <h2>{title}</h2>
        <div className="window-toolbar">
          {toolbar}
          <button type="button" title="Minimize" onClick={() => onStateChange(isMinimized ? "normal" : "minimized")}>_</button>
          <button type="button" title={isMaximized ? "Restore" : "Maximize"} onClick={() => onStateChange(isMaximized ? "normal" : "maximized")}>{isMaximized ? "▣" : "□"}</button>
          <button type="button" title="Close (minimize for now)" onClick={() => onStateChange("minimized")}>×</button>
        </div>
      </div>
      {!isMinimized && <div className="window-content">{children}</div>}
    </section>
  );
}
