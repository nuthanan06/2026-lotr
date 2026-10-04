"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { formatDistanceToNowStrict } from "date-fns";
import { CloudFogIcon, EyeIcon, MapIcon, SparklesIcon } from "lucide-react";
import { ImageOverlay, MapContainer, Marker, Pane, Polygon, Polyline, Tooltip, useMap } from "react-leaflet";

import { useConflicts, useGroupView, useGroups, useMapCharacters, useRegions } from "@/hooks/useMap";
import { MAP_IMAGE, centroid, fromLatLng, toLatLng, type MapPoint } from "@/lib/mapGeo";
import { cn } from "@/lib/utils";
import type { ConflictResponse, MapCharacter, RegionResponse } from "@/types/api";
import { avatarColor, initials } from "./parts";
import { useMapFocus, useOptionalMapActions } from "./MapActions";
import { useMapParams, type MapView } from "./useMapParams";

const IMAGE_BOUNDS = L.latLngBounds([0, 0], [MAP_IMAGE.height, MAP_IMAGE.width]);
const FOG_FADE_MS = 2600;

// Crisis view: the map stays fully visible. Undiscovered regions are traced
// with a faint dashed line; discovered-but-not-yet-revealed ones in gold.
const UNDISCOVERED_OUTLINE: L.PathOptions = {
  color: "#3b2a17",
  weight: 1.5,
  opacity: 0.7,
  dashArray: "6 6",
  fill: false,
  interactive: false,
};
const PENDING_OUTLINE: L.PathOptions = {
  color: "#d08700",
  weight: 2,
  opacity: 0.95,
  dashArray: "2 7",
  lineCap: "round",
  fill: false,
  interactive: false,
};
// Delegate views: unrevealed regions sit under fog. The pane is blurred in
// CSS (.leaflet-fog-pane) so the edges read as mist, not cut-out polygons.
const FOG: L.PathOptions = { stroke: false, fillColor: "#2a2016", fillOpacity: 1, interactive: false };
const HIT: L.PathOptions = { stroke: false, fill: true, fillOpacity: 0 };
const HOVER: L.PathOptions = { stroke: true, color: "#d08700", weight: 2, opacity: 0.9, fillOpacity: 0 };
const SELECTED: L.PathOptions = {
  stroke: true,
  color: "#f57132",
  weight: 3,
  opacity: 1,
  fill: true,
  fillColor: "#f57132",
  fillOpacity: 0.08,
};
const BATTLE_LINE: L.PathOptions = {
  color: "#b91c1c",
  weight: 2.5,
  opacity: 0.85,
  dashArray: "1 7",
  lineCap: "round",
  interactive: false,
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function pinIcon(c: MapCharacter, opts: { groupColor?: string; ghost?: boolean }) {
  const face = c.avatar_url
    ? `<img class="lotr-pin-face" src="${escapeHtml(c.avatar_url)}" alt="" />`
    : `<span class="lotr-pin-face lotr-pin-initials" style="background:${avatarColor(c.name)}">${escapeHtml(initials(c.name))}</span>`;
  const badges: string[] = [];
  if (c.has_ring && !opts.ghost) {
    badges.push(
      `<span class="lotr-badge" style="top:-5px"><img src="/lotr/ring-badge-bg.svg" width="19" height="19" alt="" /><img style="left:1px;top:1px" src="/lotr/ring-badge.svg" width="17" height="17" alt="" /></span>`
    );
  }
  if (c.army_mobilized && !opts.ghost) {
    badges.push(
      `<span class="lotr-badge" style="top:${c.has_ring ? 16 : -5}px"><img src="/lotr/army-badge-bg.svg" width="19" height="19" alt="" /><img style="left:3px;top:3px" src="/lotr/army-badge.svg" width="13" height="13" alt="" /></span>`
    );
  }
  const groupRing = opts.groupColor
    ? `<span class="lotr-pin-group" style="border-color:${escapeHtml(opts.groupColor)}"></span>`
    : "";
  const classes = ["lotr-pin", c.has_ring && !opts.ghost && "lotr-pin-ring", opts.ghost && "lotr-pin-ghost"]
    .filter(Boolean)
    .join(" ");
  return L.divIcon({
    className: "",
    iconSize: [39, 58],
    iconAnchor: [19, 58],
    tooltipAnchor: [0, -58],
    html: `<div class="${classes}">
      <img class="lotr-pin-tail" src="/lotr/pin-tail.svg" width="25.7947" height="24.8187" alt="" />
      <img class="lotr-pin-head" src="/lotr/pin-head.svg" width="39" height="39" alt="" />
      ${face}${groupRing}${badges.join("")}
    </div>`,
  });
}

function battleIcon(conflict: ConflictResponse, overdue: boolean) {
  return L.divIcon({
    className: "",
    iconSize: [39, 39],
    iconAnchor: [19.5, 19.5],
    html: `<div class="lotr-battle${overdue ? " lotr-battle-overdue" : ""}">
      <span class="lotr-battle-pulse"></span>
      <img src="/lotr/conflict-badge-bg.svg" width="39" height="39" alt="" />
      <img style="left:7.5px;top:7.5px" src="/lotr/conflict-badge.svg" width="24" height="24" alt="" />
      <span class="lotr-battle-label">${escapeHtml(conflict.name)}</span>
    </div>`,
  });
}

function CharacterPin({
  character,
  groupColor,
  editable,
}: {
  character: MapCharacter;
  groupColor?: string;
  editable: boolean;
}) {
  const actions = useOptionalMapActions();
  const { navigate } = useMapParams();
  const ref = useRef<L.Marker>(null);
  const position = toLatLng({ x: character.x!, y: character.y! });
  const icon = useMemo(
    () => pinIcon(character, { groupColor }),
    [character.name, character.avatar_url, character.has_ring, character.army_mobilized, groupColor] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <Marker
      ref={ref}
      position={position}
      icon={icon}
      draggable={editable && !!actions}
      zIndexOffset={character.has_ring ? 1000 : 0}
      eventHandlers={{
        click: () => actions && navigate({ tab: "character", character: character.id }),
        dragend: (e) => {
          const ll = (e.target as L.Marker).getLatLng();
          actions?.requestMove(character, fromLatLng(ll.lat, ll.lng), () => ref.current?.setLatLng(position));
        },
      }}
    >
      <Tooltip direction="top" offset={[0, -4]}>
        {character.name}
      </Tooltip>
    </Marker>
  );
}

/** Someone outside the viewing group, shown where the group last saw them. */
function GhostPin({ character, at, seenAt }: { character: MapCharacter; at: MapPoint; seenAt: string }) {
  const icon = useMemo(
    () => pinIcon(character, { ghost: true }),
    [character.name, character.avatar_url] // eslint-disable-line react-hooks/exhaustive-deps
  );
  return (
    <Marker position={toLatLng(at)} icon={icon} zIndexOffset={-500}>
      <Tooltip direction="top" offset={[0, -4]}>
        {character.name} · last seen {formatDistanceToNowStrict(new Date(seenAt))} ago
      </Tooltip>
    </Marker>
  );
}

// Map units (image px) the battle marker floats above its highest party.
const BATTLE_LIFT = 230;

/** A battle: a pulsing marker above the parties, joined to each by a dotted line. */
function BattleMarker({ conflict, positions }: { conflict: ConflictResponse; positions: MapPoint[] }) {
  const actions = useOptionalMapActions();
  const { navigate } = useMapParams();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!conflict.deadline_at) return;
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, [conflict.deadline_at]);
  const overdue = !!conflict.deadline_at && Date.parse(conflict.deadline_at) <= now;

  // Float the marker above the highest party pin so the pins never cover it.
  const center = toLatLng(centroid(positions));
  const top = Math.max(...positions.map((p) => toLatLng(p)[0]));
  const anchor: [number, number] = [top + BATTLE_LIFT, center[1]];
  const icon = useMemo(() => battleIcon(conflict, overdue), [conflict, overdue]);

  return (
    <>
      {positions.map((p, i) => (
        <Polyline key={i} positions={[anchor, toLatLng(p)]} pathOptions={BATTLE_LINE} />
      ))}
      <Marker
        position={anchor}
        icon={icon}
        zIndexOffset={800}
        eventHandlers={{ click: () => actions && navigate({ tab: "conflict", conflict: conflict.id }) }}
      />
    </>
  );
}

function RegionHitArea({
  region,
  selected,
  onHover,
}: {
  region: RegionResponse;
  selected: boolean;
  onHover: (region: RegionResponse | null) => void;
}) {
  const { navigate } = useMapParams();
  const ref = useRef<L.Polygon>(null);
  const rest = selected ? SELECTED : HIT;
  useEffect(() => {
    ref.current?.setStyle(rest);
  }, [rest]);
  return (
    <Polygon
      ref={ref}
      positions={region.polygon.map(([x, y]) => toLatLng({ x, y }))}
      pathOptions={rest}
      eventHandlers={{
        click: () => navigate({ tab: "map", region: region.id }),
        mouseover: () => {
          if (!selected) ref.current?.setStyle(HOVER);
          onHover(region);
        },
        mouseout: () => {
          ref.current?.setStyle(rest);
          onHover(null);
        },
      }}
    />
  );
}

/**
 * Fog over every region delegates haven't been shown yet. When regions are
 * revealed (a crisis update is published), their fog fades away instead of
 * blinking out, and the newly revealed names are announced.
 */
function FogLayer({
  regions,
  onRevealed,
}: {
  regions: RegionResponse[];
  onRevealed: (names: string[]) => void;
}) {
  const fogged = useMemo(() => regions.filter((r) => !r.revealed), [regions]);
  const previous = useRef<Map<number, RegionResponse> | null>(null);
  const [fading, setFading] = useState<RegionResponse[]>([]);

  useEffect(() => {
    if (!regions.length) return;
    const current = new Map(fogged.map((r) => [r.id, r]));
    const before = previous.current;
    previous.current = current;
    if (!before) return; // first load: nothing to animate
    const lifted = [...before.values()].filter((r) => !current.has(r.id));
    if (!lifted.length) return;
    setFading((f) => [...f, ...lifted]);
    onRevealed(lifted.map((r) => r.name));
    const t = setTimeout(
      () => setFading((f) => f.filter((r) => !lifted.some((l) => l.id === r.id))),
      FOG_FADE_MS
    );
    return () => clearTimeout(t);
  }, [fogged, regions.length, onRevealed]);

  return (
    <Pane name="fog" className="leaflet-fog-pane" style={{ zIndex: 420 }}>
      {fogged.map((r) => (
        <Polygon key={r.id} positions={r.polygon.map(([x, y]) => toLatLng({ x, y }))} pathOptions={FOG} />
      ))}
      {fading.map((r) => (
        <Polygon
          key={`fade-${r.id}`}
          positions={r.polygon.map(([x, y]) => toLatLng({ x, y }))}
          pathOptions={{ ...FOG, className: "lotr-fog-fade" }}
        />
      ))}
    </Pane>
  );
}

/** Opens at "cover" zoom (map fills the viewport, as in the design). */
function FitCover() {
  const map = useMap();
  useEffect(() => {
    // The container's final size can land a few frames after mount, so keep
    // re-fitting on resize until the user takes over by panning or zooming.
    let userMoved = false;
    const container = map.getContainer();
    const takeOver = () => (userMoved = true);
    const fit = () => {
      map.invalidateSize();
      const size = map.getSize();
      if (!size.x || !size.y) return;
      // Round up to the zoom step, or Leaflet snaps down and leaves bands at the edges.
      const cover =
        Math.ceil(Math.max(Math.log2(size.x / MAP_IMAGE.width), Math.log2(size.y / MAP_IMAGE.height)) * 4) / 4;
      map.setMinZoom(Math.min(cover, Math.log2(size.x / MAP_IMAGE.width)) - 0.5);
      if (!userMoved) map.setView(IMAGE_BOUNDS.getCenter(), cover, { animate: false });
    };
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    container.addEventListener("pointerdown", takeOver);
    container.addEventListener("wheel", takeOver, { passive: true });
    map.on("dragstart", takeOver);
    fit();
    return () => {
      observer.disconnect();
      container.removeEventListener("pointerdown", takeOver);
      container.removeEventListener("wheel", takeOver);
      map.off("dragstart", takeOver);
    };
  }, [map]);
  return null;
}

function FocusController() {
  const map = useMap();
  const focus = useMapFocus();
  useEffect(() => {
    if (focus) map.flyTo(toLatLng(focus.point), Math.max(map.getZoom(), -0.5), { duration: 0.6 });
  }, [focus, map]);
  return null;
}

function ViewToggle({ view, onChange }: { view: MapView; onChange: (view: MapView) => void }) {
  const options: { id: MapView; label: string; icon: typeof EyeIcon }[] = [
    { id: "crisis", label: "Crisis view", icon: MapIcon },
    { id: "delegate", label: "Delegate view", icon: EyeIcon },
  ];
  return (
    <div role="radiogroup" aria-label="Map view" className="bg-background flex gap-1 rounded-lg p-1 shadow-md">
      {options.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={view === id}
          onClick={() => onChange(id)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            view === id ? "bg-accent text-accent-foreground" : "hover:bg-muted"
          )}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

export default function MapCanvas({
  selectedRegionId,
  view,
  groupId = null,
  readOnly = false,
  onViewChange,
  overlay,
}: {
  selectedRegionId: number | null;
  view: MapView;
  /** Show the map as this group's delegates know it. */
  groupId?: number | null;
  /** The delegate screen: no editing, no region clicks. */
  readOnly?: boolean;
  onViewChange?: (view: MapView) => void;
  /** Extra chips under the top-left controls (e.g. the group name). */
  overlay?: React.ReactNode;
}) {
  const { data: characters = [] } = useMapCharacters();
  const { data: regions = [] } = useRegions();
  const { data: conflicts = [] } = useConflicts();
  const { data: groups = [] } = useGroups();
  const { data: groupView } = useGroupView(groupId);
  const [map, setMap] = useState<L.Map | null>(null);
  const [hovered, setHovered] = useState<RegionResponse | null>(null);
  const [revealedNames, setRevealedNames] = useState<string[]>([]);

  useEffect(() => {
    if (!revealedNames.length) return;
    const t = setTimeout(() => setRevealedNames([]), 6000);
    return () => clearTimeout(t);
  }, [revealedNames]);

  const delegate = view === "delegate" || groupId != null;
  const groupColor = useMemo(() => new Map(groups.map((g) => [g.id, g.color])), [groups]);
  const hiddenRegionIds = useMemo(() => new Set(regions.filter((r) => !r.revealed).map((r) => r.id)), [regions]);
  const pending = regions.filter((r) => r.discovered && !r.revealed);

  // Who is drawn, and where.
  const members = groupView ? new Set(groupView.member_ids) : null;
  const live = characters.filter((c) => {
    if (c.x == null || c.y == null) return false;
    if (members) return members.has(c.id);
    // Delegates only see people in lands they've been shown.
    return !(delegate && c.region_id != null && hiddenRegionIds.has(c.region_id));
  });
  const ghosts = (groupView?.last_seen ?? []).flatMap((seen) => {
    const character = characters.find((c) => c.id === seen.character_id);
    return character ? [{ seen, character }] : [];
  });

  const battles = conflicts
    .filter((k) => k.status === "ONGOING")
    .map((k) => ({
      conflict: k,
      positions: live.filter((c) => k.parties.some((p) => p.id === c.id)).map((c) => ({ x: c.x!, y: c.y! })),
    }))
    .filter((b) => b.positions.length > 0);

  return (
    <div className="absolute inset-0 isolate bg-[#3a2e22]">
      <MapContainer
        ref={setMap}
        crs={L.CRS.Simple}
        bounds={IMAGE_BOUNDS}
        maxBounds={IMAGE_BOUNDS.pad(0.1)}
        maxBoundsViscosity={0.8}
        zoomSnap={0.25}
        zoomDelta={0.5}
        maxZoom={2}
        zoomControl={false}
        attributionControl={false}
        className="size-full bg-transparent!"
      >
        <FitCover />
        <FocusController />
        <ImageOverlay url={MAP_IMAGE.src} bounds={IMAGE_BOUNDS} />

        {delegate ? (
          <FogLayer regions={regions} onRevealed={setRevealedNames} />
        ) : (
          <>
            {regions
              .filter((r) => !r.discovered)
              .map((r) => (
                <Polygon
                  key={r.id}
                  positions={r.polygon.map(([x, y]) => toLatLng({ x, y }))}
                  pathOptions={UNDISCOVERED_OUTLINE}
                />
              ))}
            {pending.map((r) => (
              <Polygon
                key={`p-${r.id}`}
                positions={r.polygon.map(([x, y]) => toLatLng({ x, y }))}
                pathOptions={PENDING_OUTLINE}
              />
            ))}
          </>
        )}

        {!readOnly ? (
          <Pane name="region-hits" style={{ zIndex: 430 }}>
            {regions.map((r) => (
              <RegionHitArea key={r.id} region={r} selected={r.id === selectedRegionId} onHover={setHovered} />
            ))}
          </Pane>
        ) : null}

        <Pane name="battles" style={{ zIndex: 440 }}>
          {battles.map(({ conflict, positions }) => (
            <BattleMarker key={conflict.id} conflict={conflict} positions={positions} />
          ))}
        </Pane>
        {ghosts.map(({ seen, character }) => (
          <GhostPin key={`ghost-${character.id}`} character={character} at={seen} seenAt={seen.seen_at} />
        ))}
        {live.map((c) => (
          <CharacterPin
            key={c.id}
            character={c}
            groupColor={groups.length > 1 && c.group_id != null ? groupColor.get(c.group_id) : undefined}
            editable={!delegate && !readOnly}
          />
        ))}
      </MapContainer>

      <div className="pointer-events-none absolute top-4 left-4 z-[1000] flex flex-col items-start gap-2">
        {onViewChange ? (
          <div className="pointer-events-auto">
            <ViewToggle view={view} onChange={onViewChange} />
          </div>
        ) : null}
        {overlay}
        {delegate && !readOnly ? (
          <p className="bg-background/90 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs shadow-sm">
            <CloudFogIcon className="size-3.5" />
            Showing what delegates have been shown · {hiddenRegionIds.size} of {regions.length} regions hidden
          </p>
        ) : null}
        {!delegate && pending.length ? (
          <p className="bg-background/90 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs shadow-sm">
            <SparklesIcon className="text-primary size-3.5" />
            {pending.length} discovered region{pending.length === 1 ? "" : "s"} will be revealed at the next crisis
            update
          </p>
        ) : null}
        {hovered ? (
          <p className="bg-background/90 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm">
            {hovered.name}
            <span className="text-muted-foreground font-normal">
              {!hovered.discovered ? " · undiscovered" : !hovered.revealed ? " · reveals next update" : ""}
            </span>
          </p>
        ) : null}
      </div>

      {revealedNames.length ? (
        <div className="lotr-reveal-banner pointer-events-none absolute bottom-8 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-[#2a2016]/90 px-5 py-2 text-sm font-medium text-[#f5e6c4] shadow-lg">
          <SparklesIcon className="mr-1.5 inline size-4 text-[#e8c468]" />
          New lands revealed: {revealedNames.join(", ")}
        </div>
      ) : null}

      <div className="absolute bottom-7 left-7 z-[1000] flex h-[43px] w-[76px] items-center rounded-[20px] bg-white text-2xl leading-8 text-[#1d1d1d] shadow-md">
        <button
          type="button"
          aria-label="Zoom out"
          className="flex h-full flex-1 items-center justify-center rounded-l-[20px] hover:bg-black/5"
          onClick={() => map?.zoomOut()}
        >
          -
        </button>
        <span className="h-[41px] w-px bg-black" aria-hidden />
        <button
          type="button"
          aria-label="Zoom in"
          className="flex h-full flex-1 items-center justify-center rounded-r-[20px] hover:bg-black/5"
          onClick={() => map?.zoomIn()}
        >
          +
        </button>
      </div>
    </div>
  );
}
