"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

import { MapActionsProvider } from "./MapActions";
import { MapSidebar } from "./MapSidebar";
import { useMapParams } from "./useMapParams";

// Leaflet touches `window` on import, so the canvas only renders client-side.
const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#3a2e22]" />,
});

export function MapPage() {
  const { regionId, view, setView } = useMapParams();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <MapActionsProvider>
      {/* Full-bleed like the design; the app navbar is hidden on this route. */}
      <main className="relative h-dvh overflow-hidden">
        <MapCanvas selectedRegionId={regionId} view={view} onViewChange={setView} />
        <MapSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      </main>
    </MapActionsProvider>
  );
}
