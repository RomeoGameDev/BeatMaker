"use client";

import type { ReactNode } from "react";

export type TabItem<T extends string = string> = { id: T; label: string; content: ReactNode };

type Props<T extends string = string> = {
  title: string;
  tabs: TabItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  className?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

export default function TabbedPanel<T extends string = string>({ title, tabs, activeTab, onTabChange, className = "", collapsed = false, onCollapsedChange }: Props<T>) {
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  return (
    <section className={`window-panel tabbed-panel ${collapsed ? "collapsed" : ""} ${className}`}>
      <div className="window-titlebar"><h2>{title}</h2>{onCollapsedChange && <button type="button" className="panel-collapse-button" aria-expanded={!collapsed} aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`} onClick={() => onCollapsedChange(!collapsed)}>{collapsed ? "▸" : "▾"}</button>}</div>
      {!collapsed && <>
        <div className="tab-list" role="tablist" aria-label={title}>
          {tabs.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? "active-tab" : ""} onClick={() => onTabChange(tab.id)}>{tab.label}</button>
          ))}
        </div>
        <div className="window-content tab-content">{active?.content}</div>
      </>}
    </section>
  );
}
