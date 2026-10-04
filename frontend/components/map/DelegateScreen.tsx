"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { UsersIcon } from "lucide-react";

import { useGroups } from "@/hooks/useMap";

const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#3a2e22]" />,
});

/**
 * Read-only map for delegates (a projector or a group's table screen):
 * fog over unrevealed lands, no editing. With ?group=<id> it shows only what
 * that group knows — its own members live, everyone else where last seen.
 */
export function DelegateScreen() {
  const params = useSearchParams();
  const raw = params.get("group");
  const groupId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  const { data: groups = [] } = useGroups();
  const group = groups.find((g) => g.id === groupId);

  return (
    <main className="relative h-dvh overflow-hidden">
      <MapCanvas
        selectedRegionId={null}
        view="delegate"
        groupId={groupId}
        readOnly
        overlay={
          <div className="bg-background/95 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold shadow-md">
            {group ? (
              <>
                <span className="size-3 rounded-full" style={{ backgroundColor: group.color }} />
                {group.name}
                <span className="text-muted-foreground text-xs font-normal">· faded figures show where others were last seen</span>
              </>
            ) : (
              <>
                <UsersIcon className="size-4" />
                Middle-earth
              </>
            )}
          </div>
        }
      />
    </main>
  );
}
