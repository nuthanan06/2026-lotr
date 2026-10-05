"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type SidebarTab = "map" | "character" | "conflict" | "groups" | "directives";
const TABS: SidebarTab[] = ["map", "character", "conflict", "groups", "directives"];

/**
 * - crisis: staff see the whole map; undiscovered regions are only outlined.
 * - delegate: what delegates may see — undiscovered lands (and anyone in
 *   them) are hidden under fog. Shareable as /map?view=delegate for a projector.
 */
export type MapView = "crisis" | "delegate";

/**
 * Sidebar navigation and the map view live in the URL (?tab=character&character=3)
 * so the browser back button and the sidebar's ← arrows behave the same way,
 * and a view can be shared by link.
 */
export function useMapParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawTab = params.get("tab") as SidebarTab | null;
  const tab: SidebarTab = rawTab && TABS.includes(rawTab) ? rawTab : "map";
  const view: MapView = params.get("view") === "delegate" ? "delegate" : "crisis";
  const num = (key: string) => {
    const v = params.get(key);
    return v != null && /^\d+$/.test(v) ? Number(v) : null;
  };
  const seenBy = view === "delegate" ? num("seenBy") : null;

  const navigate = useCallback(
    (next: { tab: SidebarTab; character?: number | null; conflict?: number | null; region?: number | null }) => {
      const q = new URLSearchParams({ tab: next.tab });
      if (next.character != null) q.set("character", String(next.character));
      if (next.conflict != null) q.set("conflict", String(next.conflict));
      if (next.region != null) q.set("region", String(next.region));
      if (view === "delegate") q.set("view", "delegate");
      if (view === "delegate" && seenBy != null) q.set("seenBy", String(seenBy));
      router.push(`${pathname}?${q}`, { scroll: false });
    },
    [router, pathname, view, seenBy]
  );

  /** Preview delegate view as one group sees it (null = whole committee). */
  const setSeenBy = useCallback(
    (groupId: number | null) => {
      const q = new URLSearchParams(params.toString());
      if (groupId != null) q.set("seenBy", String(groupId));
      else q.delete("seenBy");
      router.replace(`${pathname}?${q}`, { scroll: false });
    },
    [router, pathname, params]
  );

  const setView = useCallback(
    (next: MapView) => {
      const q = new URLSearchParams(params.toString());
      if (next === "delegate") q.set("view", "delegate");
      else {
        q.delete("view");
        q.delete("seenBy");
      }
      router.replace(`${pathname}?${q}`, { scroll: false });
    },
    [router, pathname, params]
  );

  return {
    tab,
    view,
    seenBy,
    setSeenBy,
    characterId: num("character"),
    conflictId: num("conflict"),
    regionId: num("region"),
    navigate,
    setView,
    back: () => router.back(),
  };
}
