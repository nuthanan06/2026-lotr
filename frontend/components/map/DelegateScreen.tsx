"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { UsersIcon } from "lucide-react";

import type { ConflictResponse, GroupView, MapCharacter, RegionResponse, ScreenView } from "@/types/api";
import type { MapSource } from "./MapCanvas";

const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#3a2e22]" />,
});

async function fetchScreen(token: string): Promise<ScreenView> {
  const res = await fetch(`/api/screen/${token}`, { cache: "no-store" });
  if (!res.ok) throw new Error(res.status === 404 ? "invalid" : "unavailable");
  return res.json();
}

/** Fill in the staff-only fields the shared map component expects. */
function toCharacter(c: ScreenView["characters"][number] | ScreenView["last_seen"][number]): MapCharacter {
  return {
    id: c.id,
    name: c.name,
    avatar_url: c.avatar_url,
    x: c.x,
    y: c.y,
    has_ring: "has_ring" in c ? c.has_ring : false,
    army_mobilized: "army_mobilized" in c ? c.army_mobilized : false,
    created_at: "",
    race: "",
    region_id: null,
    group_id: null,
    corruption: 0,
    corruption_a: 1,
    corruption_a_is_custom: false,
    ring_hours: 0,
    accruing: false,
    corruption_rate_per_hour: 0,
    as_of: "",
    ongoing_conflict_ids: [],
  };
}

function toSource(screen: ScreenView, isGroup: boolean): MapSource {
  const live = screen.characters.map(toCharacter);
  const characters = [...live, ...screen.last_seen.map(toCharacter)];
  const byId = new Map(characters.map((c) => [c.id, c]));
  const regions: RegionResponse[] = screen.regions.map((r) => ({
    id: r.id,
    slug: "",
    name: r.name,
    polygon: r.polygon,
    discovered: r.revealed,
    revealed: r.revealed,
    discoveries: [],
    status: null,
    notes: null,
  }));
  const conflicts: ConflictResponse[] = screen.conflicts.map((k) => ({
    id: k.id,
    name: k.name,
    status: "ONGOING",
    parties: k.party_ids.flatMap((id) => {
      const c = byId.get(id);
      return c ? [{ id, name: c.name, avatar_url: c.avatar_url, created_at: "", race: "" }] : [];
    }),
    winner_id: null,
    outcome_summary: null,
    created_at: "",
    resolved_at: null,
    deadline_at: k.deadline_at,
  }));
  const groupView: GroupView | null = isGroup
    ? {
        group: { id: 0, name: screen.title, color: screen.color ?? "", created_at: "", member_ids: [], screen_token: "" },
        member_ids: live.map((c) => c.id),
        last_seen: screen.last_seen.map((s) => ({ character_id: s.id, x: s.x, y: s.y, seen_at: s.seen_at })),
        revealed_region_ids: screen.regions.filter((r) => r.revealed).map((r) => r.id),
      }
    : null;
  return { characters, regions, conflicts, groupView };
}

/**
 * Public, read-only map for delegates, opened from a secret link
 * (/screen/<token>) — no staff login on delegate devices. A group's link
 * shows only what that group knows: its own members live, everyone else
 * where last seen, and the lands it has been shown.
 */
export function DelegateScreen({ token }: { token: string }) {
  const { data: screen, error } = useQuery({
    queryKey: ["screen", token],
    queryFn: () => fetchScreen(token),
    refetchInterval: 5000,
    retry: (count, err) => err.message !== "invalid" && count < 3,
  });
  const source = useMemo(() => (screen ? toSource(screen, screen.color != null) : null), [screen]);

  if (error?.message === "invalid") {
    return (
      <main className="flex h-dvh items-center justify-center bg-[#3a2e22] p-6 text-center text-[#f5e6c4]">
        <div>
          <p className="text-lg font-semibold">This map link isn&apos;t valid.</p>
          <p className="mt-1 text-sm opacity-80">Ask crisis staff for your group&apos;s current link.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-dvh overflow-hidden">
      {source && screen ? (
        <MapCanvas
          selectedRegionId={null}
          view="delegate"
          readOnly
          source={source}
          overlay={
            <div className="bg-background/95 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold shadow-md">
              {screen.color ? (
                <span className="size-3 rounded-full" style={{ backgroundColor: screen.color }} />
              ) : (
                <UsersIcon className="size-4" />
              )}
              {screen.title}
            </div>
          }
        />
      ) : (
        <div className="absolute inset-0 bg-[#3a2e22]" />
      )}
    </main>
  );
}
