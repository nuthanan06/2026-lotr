"use client";

import { useState } from "react";
import Link from "next/link";
import { ListIcon, PanelRightCloseIcon, PanelRightOpenIcon, UsersIcon } from "lucide-react";

import { CharacterManagerDialog } from "@/components/crisis/CharacterManagerDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CharacterTab } from "./CharacterTab";
import { ConflictTab } from "./ConflictTab";
import { DirectivesTab } from "./DirectivesTab";
import { GroupsTab } from "./GroupsTab";
import { MapTab } from "./MapTab";
import { useMapParams, type SidebarTab } from "./useMapParams";

const TABS: { id: SidebarTab; label: string }[] = [
  { id: "map", label: "Map" },
  { id: "character", label: "Character" },
  { id: "conflict", label: "Conflict" },
  { id: "groups", label: "Groups" },
  { id: "directives", label: "Directives" },
];

export function MapSidebar({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { tab, navigate } = useMapParams();
  const [manageOpen, setManageOpen] = useState(false);

  if (!open) {
    return (
      <Button
        variant="outline"
        size="icon-lg"
        onClick={() => onOpenChange(true)}
        aria-label="Open sidebar"
        className="bg-background absolute top-4 right-4 z-10 shadow-md"
      >
        <PanelRightOpenIcon />
      </Button>
    );
  }

  return (
    <aside className="bg-background absolute inset-y-0 right-0 z-10 flex w-[381px] max-w-full flex-col border-l shadow-xl">
      <div className="shrink-0 space-y-3 border-b px-5 pt-3 pb-4">
        <div className="flex h-8 items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
              aria-label="Collapse sidebar"
              className="-ml-1.5"
            >
              <PanelRightCloseIcon />
            </Button>
            <span className="text-sm font-semibold tracking-tight">Middle-earth</span>
          </div>
          <div className="flex items-center">
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
              <Link href="/">
                <ListIcon />
                Tracker
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setManageOpen(true)}>
              <UsersIcon />
              Characters
            </Button>
          </div>
        </div>
        <nav role="tablist" aria-label="Map sidebar" className="bg-muted grid grid-cols-5 gap-0.5 rounded-lg p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => navigate({ tab: t.id })}
              className={cn(
                "rounded-md py-1.5 text-[13px] leading-5 font-medium transition-colors",
                tab === t.id
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-6" role="tabpanel">
        {tab === "map" ? <MapTab /> : null}
        {tab === "character" ? <CharacterTab /> : null}
        {tab === "conflict" ? <ConflictTab /> : null}
        {tab === "groups" ? <GroupsTab /> : null}
        {tab === "directives" ? <DirectivesTab /> : null}
      </div>
      <CharacterManagerDialog open={manageOpen} onOpenChange={setManageOpen} />
    </aside>
  );
}
