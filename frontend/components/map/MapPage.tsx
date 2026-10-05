"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGroups } from "@/hooks/useMap";
import { MapActionsProvider } from "./MapActions";
import { MapSidebar } from "./MapSidebar";
import { useMapParams } from "./useMapParams";

// Leaflet touches `window` on import, so the canvas only renders client-side.
const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#3a2e22]" />,
});

const ALL = "all";

export function MapPage() {
  const { regionId, view, setView, seenBy, setSeenBy } = useMapParams();
  const { data: groups = [] } = useGroups();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <MapActionsProvider>
      {/* Full-bleed like the design; the app navbar is hidden on this route. */}
      <main className="relative h-dvh overflow-hidden">
        <MapCanvas
          selectedRegionId={regionId}
          view={view}
          groupId={seenBy}
          onViewChange={setView}
          overlay={
            view === "delegate" && groups.length > 1 ? (
              <div className="bg-background pointer-events-auto flex items-center gap-2 rounded-lg py-1 pr-1 pl-3 text-xs shadow-md">
                Seen by
                <Select
                  value={seenBy != null ? String(seenBy) : ALL}
                  onValueChange={(v) => setSeenBy(v === ALL ? null : Number(v))}
                >
                  <SelectTrigger size="sm" className="h-7 min-w-[170px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Whole committee</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        <span className="size-2 rounded-full" style={{ backgroundColor: g.color }} />
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null
          }
        />
        <MapSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      </main>
    </MapActionsProvider>
  );
}
