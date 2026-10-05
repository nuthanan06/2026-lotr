"use client";

import { useEffect, useState } from "react";
import { MousePointerClickIcon, SparklesIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  useGameState,
  useGroups,
  useMapCharacters,
  useRegions,
  useRevealDiscovered,
  useSetClockPaused,
  useSetRegionDiscovery,
  useUpdateRegion,
} from "@/hooks/useMap";
import { hasPendingReveal } from "@/lib/mapGeo";
import type { RegionResponse } from "@/types/api";
import { useMapActions } from "./MapActions";
import { CharacterAvatar, SectionHeading } from "./parts";
import { useMapParams } from "./useMapParams";

// The design's switch is 44×24.
export const figmaSwitch =
  "data-[size=default]:h-6 data-[size=default]:w-11 **:data-[slot=switch-thumb]:size-5! **:data-[slot=switch-thumb]:data-checked:translate-x-5!";

const NOBODY = "__nobody__";

function LegendItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span className="relative size-6 shrink-0">{icon}</span>
      {label}
    </li>
  );
}

function BadgeIcon({ bg, icon, size }: { bg: string; icon: string; size: number }) {
  return (
    <>
      <img src={bg} width={24} height={24} alt="" className="absolute inset-0" />
      <img
        src={icon}
        width={size}
        height={size}
        alt=""
        className="absolute"
        style={{ left: (24 - size) / 2, top: (24 - size) / 2 }}
      />
    </>
  );
}

/** One row of the settings list: label + hint on the left, control on the right. */
function SettingRow({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-3.5 py-3">
      <div className="min-w-0">
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </Label>
        {hint ? <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function MapTab() {
  const { regionId, view } = useMapParams();
  const { data: regions = [] } = useRegions();
  const region = regions.find((r) => r.id === regionId);
  const { data: characters = [] } = useMapCharacters();
  const { data: game } = useGameState();
  const { requestRingHolder } = useMapActions();
  const { mutate: setClockPaused } = useSetClockPaused();
  const { mutate: reveal, isPending: revealing } = useRevealDiscovered();
  const pending = regions.filter(hasPendingReveal);

  return (
    <div className="space-y-7">
      <section>
        <SectionHeading title="Legend" />
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          <LegendItem
            label="Conflict"
            icon={<BadgeIcon bg="/lotr/badge-gold-bg.svg" icon="/lotr/legend-conflict.svg" size={15} />}
          />
          <LegendItem
            label="Ring Holder"
            icon={<BadgeIcon bg="/lotr/legend-ring-bg.svg" icon="/lotr/legend-ring.svg" size={22} />}
          />
          <LegendItem
            label="Mobilized Armies"
            icon={<BadgeIcon bg="/lotr/badge-gold-bg.svg" icon="/lotr/legend-army.svg" size={18} />}
          />
          <LegendItem
            label="Reveals next update"
            icon={<span className="absolute inset-0 rounded-full border-2 border-dotted border-[#d08700]" />}
          />
          <LegendItem
            label="Undiscovered"
            icon={
              view === "delegate" ? (
                <span className="absolute inset-0 rounded-full bg-[#2a2016] blur-[1px]" />
              ) : (
                <span className="absolute inset-0 rounded-full border-[1.5px] border-dashed border-[#3b2a17]/70" />
              )
            }
          />
        </ul>
      </section>

      <section>
        <SectionHeading title="Actions" />
        <div className="mt-3 divide-y rounded-lg border">
          <SettingRow label="Ring holder" htmlFor="ring-holder">
            <Select
              value={game?.ring_holder_id != null ? String(game.ring_holder_id) : NOBODY}
              onValueChange={(v) => requestRingHolder(v === NOBODY ? null : Number(v))}
            >
              <SelectTrigger id="ring-holder" className="w-[140px] text-xs">
                <SelectValue placeholder="Select option" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value={NOBODY}>Nobody</SelectItem>
                {characters.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow
            label="Reveal to delegates"
            hint={pending.length ? `${pending.length} waiting` : undefined}
          >
            <Button size="sm" disabled={!pending.length || revealing} onClick={() => reveal()}>
              <SparklesIcon />
              Reveal now
            </Button>
          </SettingRow>
          <SettingRow label="Corruption clock" htmlFor="corruption-clock">
            <Switch
              id="corruption-clock"
              checked={!game?.clock_paused}
              disabled={!game}
              onCheckedChange={(running) => setClockPaused(!running)}
            />
          </SettingRow>
        </div>
      </section>

      {region ? (
        <RegionPanel key={region.id} region={region} />
      ) : (
        <div className="text-muted-foreground flex items-center gap-3 rounded-lg border border-dashed px-4 py-5 text-xs">
          <MousePointerClickIcon className="size-5 shrink-0" />
          Select a region
        </div>
      )}
    </div>
  );
}

function RegionPanel({ region }: { region: RegionResponse }) {
  const { data: characters = [] } = useMapCharacters();
  const { mutate } = useUpdateRegion();
  const { mutate: setDiscovery } = useSetRegionDiscovery();
  const { data: groups = [] } = useGroups();
  const allKnow = groups.length > 0 && groups.every((g) => region.discoveries.some((d) => d.group_id === g.id));
  const { navigate } = useMapParams();
  const [status, setStatus] = useState(region.status ?? "");
  useEffect(() => setStatus(region.status ?? ""), [region.status]);
  const present = characters.filter((c) => c.region_id === region.id);

  const saveStatus = () => {
    if (status.trim() !== (region.status ?? "")) {
      mutate({ id: region.id, body: { status: status.trim() || null } });
    }
  };

  return (
    <section>
      <SectionHeading title={region.name}>
        <Badge variant={region.discovered ? "secondary" : "outline"}>
          {region.discovered
            ? `Known to ${region.discoveries.length} of ${groups.length} group${groups.length === 1 ? "" : "s"}`
            : "Undiscovered"}
        </Badge>
      </SectionHeading>
      <div className="mt-3 divide-y rounded-lg border">
        <div className="px-3.5 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium">Discovered by</p>
            {groups.length > 1 ? (
              <button
                type="button"
                className="text-primary text-xs hover:underline"
                onClick={() => mutate({ id: region.id, body: { discovered: !allKnow } })}
              >
                {allKnow ? "Hide from all" : "All groups"}
              </button>
            ) : null}
          </div>
          <ul className="mt-2 space-y-1.5">
            {groups.map((g) => {
              const d = region.discoveries.find((x) => x.group_id === g.id);
              return (
                <li key={g.id} className="flex items-center gap-2 text-sm">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
                  <span className="min-w-0 flex-1 truncate">{g.name}</span>
                  <span className="text-muted-foreground text-[11px]">
                    {d ? (d.revealed ? "Revealed" : "Reveals next update") : "Not found"}
                  </span>
                  <Switch
                    size="sm"
                    checked={!!d}
                    aria-label={`Discovered by ${g.name}`}
                    onCheckedChange={(discovered) =>
                      setDiscovery({ id: region.id, groupId: g.id, discovered })
                    }
                  />
                </li>
              );
            })}
          </ul>
        </div>
        <div className="space-y-1.5 px-3.5 py-3">
          <Label htmlFor="region-status" className="text-sm font-medium">
            Condition
          </Label>
          <Input
            id="region-status"
            value={status}
            placeholder="e.g. Orc patrols on the roads"
            onChange={(e) => setStatus(e.target.value)}
            onBlur={saveStatus}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="h-8 text-xs md:text-xs"
          />
        </div>
        <div className="px-3.5 py-3">
          <p className="text-sm font-medium">
            Characters here <span className="text-muted-foreground font-normal">({present.length})</span>
          </p>
          {present.length ? (
            <ul className="-mx-1 mt-1.5 space-y-0.5">
              {present.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => navigate({ tab: "character", character: c.id })}
                    className="hover:bg-muted flex w-full items-center gap-2 rounded-md p-1 text-left text-sm"
                  >
                    <CharacterAvatar character={c} className="size-6 ring-0" />
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground mt-1 text-xs">Nobody is here.</p>
          )}
        </div>
      </div>
    </section>
  );
}
