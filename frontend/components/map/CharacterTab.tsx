"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronRightIcon, PencilIcon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useNotes } from "@/hooks/useCrisisNotes";
import {
  useConflicts,
  useDeleteConflict,
  useGameState,
  useGroups,
  useMoveToGroup,
  useMapCharacters,
  useMovements,
  useRegions,
  useUpdateCharacter,
} from "@/hooks/useMap";
import { randomPointIn } from "@/lib/mapGeo";
import { cn } from "@/lib/utils";
import type { MapCharacter } from "@/types/api";
import { useMapActions } from "./MapActions";
import { figmaSwitch } from "./MapTab";
import { NoteFilterButton, NoteList, useNoteFilter } from "./NoteList";
import {
  CharacterAvatar,
  CharacterTags,
  raceLabel,
  SectionHeading,
  SidebarPagination,
  SidebarSearch,
  dangerButton,
  outlineButton,
  solidButton,
  useLiveCorruption,
  usePaged,
} from "./parts";
import { useMapParams } from "./useMapParams";

export function BackArrow({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="hover:bg-muted -ml-1 rounded p-0.5">
      <img src="/lotr/arrow-long-right.svg" width={24} height={24} alt="" className="rotate-180" />
    </button>
  );
}

export function CharacterTab() {
  const { characterId } = useMapParams();
  return characterId != null ? <CharacterDetail characterId={characterId} /> : <CharacterList />;
}

function CharacterList() {
  const { data: characters = [], isLoading } = useMapCharacters();
  const { data: regions = [] } = useRegions();
  const { data: groups = [] } = useGroups();
  const { navigate } = useMapParams();
  const [query, setQuery] = useState("");

  const regionName = useMemo(() => new Map(regions.map((r) => [r.id, r.name])), [regions]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return characters;
    return characters.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.region_id != null && regionName.get(c.region_id)?.toLowerCase().includes(q))
    );
  }, [characters, query, regionName]);
  const { page, pageCount, setPage, pageItems } = usePaged(filtered, 8);

  return (
    <div>
      <SectionHeading title="Character" />
      <SidebarSearch value={query} onChange={setQuery} placeholder="Search by name or region" className="mt-4" />
      <ul className="mt-4 space-y-2">
        {pageItems.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => navigate({ tab: "character", character: c.id })}
              className="bg-background hover:bg-muted/60 flex min-h-[58px] w-full items-center gap-3 rounded-sm border border-[#d9d9d9] py-1.5 pr-3 pl-2 text-left shadow-sm"
            >
              <CharacterAvatar character={c} className="size-10" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base leading-6 font-semibold tracking-[-1px]">{c.name}</span>
                <CharacterTags character={c} group={groups.find((g) => g.id === c.group_id)} />
              </span>
              <ChevronRightIcon className="size-6 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
      {!isLoading && !filtered.length ? (
        <p className="text-muted-foreground py-6 text-center text-xs">
          {characters.length ? "No characters match." : "No characters yet — add them from Characters in the top bar."}
        </p>
      ) : null}
      <SidebarPagination page={page} pageCount={pageCount} onPage={setPage} />
    </div>
  );
}

const RANDOM = "__random__";

function CharacterDetail({ characterId }: { characterId: number }) {
  const { data: characters = [], isLoading } = useMapCharacters();
  const character = characters.find((c) => c.id === characterId);
  const { back } = useMapParams();

  if (!character) {
    return (
      <div className="space-y-3">
        <BackArrow onClick={back} />
        <p className="text-muted-foreground text-sm">{isLoading ? "Loading…" : "Character not found."}</p>
      </div>
    );
  }
  return <CharacterDetailBody character={character} />;
}

function CharacterDetailBody({ character }: { character: MapCharacter }) {
  const { back, navigate } = useMapParams();
  const actions = useMapActions();
  const { data: regions = [] } = useRegions();
  const { data: conflicts = [] } = useConflicts();
  const { mutate: update } = useUpdateCharacter();
  const { data: groups = [] } = useGroups();
  const { mutate: moveToGroup } = useMoveToGroup();
  const { mutate: deleteConflict, isPending: deleting } = useDeleteConflict();
  const { data: notes = [], isLoading: notesLoading } = useNotes({ character_id: character.id });
  const { filter, setFilter, filtered } = useNoteFilter(notes);
  const corruption = useLiveCorruption(character);
  const [draft, setDraft] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const region = regions.find((r) => r.id === character.region_id);
  const ongoing = conflicts.filter((k) => character.ongoing_conflict_ids.includes(k.id));
  const conflict = ongoing[0];

  function moveTo(value: string) {
    const target = value === RANDOM ? regions[Math.floor(Math.random() * regions.length)] : regions.find((r) => String(r.id) === value);
    if (target) actions.requestMove(character, randomPointIn(target, regions));
  }

  return (
    <div>
      <BackArrow onClick={back} />
      <header className="mt-1 flex items-center gap-5 pl-4">
        <CharacterAvatar character={character} className="size-[101px] text-3xl ring-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1">
            <h2 className="text-2xl leading-8 font-bold break-words">{character.name}</h2>
            <Button
              variant="ghost"
              size="icon-xs"
              className="mt-1 shrink-0"
              aria-label="Edit character"
              onClick={() => actions.openEditCharacter(character)}
            >
              <PencilIcon />
            </Button>
          </div>
          <div className="mt-1">
            <CharacterTags character={character} />
          </div>
        </div>
      </header>

      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className="text-muted-foreground min-w-0 flex-1 truncate">
          {character.x == null ? "Not on the map yet" : `In ${region?.name ?? "uncharted lands"}`}
        </span>
        <Select value="" onValueChange={moveTo}>
          <SelectTrigger size="sm" className="h-7 w-[140px] text-xs">
            <SelectValue placeholder={character.x == null ? "Place in…" : "Move to…"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={RANDOM}>Random location</SelectItem>
            {regions.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {character.x != null ? (
          <Button
            variant="outline"
            className={outlineButton}
            onClick={() => actions.focusMap({ x: character.x!, y: character.y! })}
          >
            View
          </Button>
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="text-muted-foreground flex-1">Travelling with</span>
        <Select
          value={character.group_id != null ? String(character.group_id) : ""}
          onValueChange={(v) => moveToGroup({ groupId: Number(v), characterIds: [character.id] })}
        >
          <SelectTrigger size="sm" className="h-7 w-[188px] text-xs">
            <SelectValue placeholder="No group" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectItem key={g.id} value={String(g.id)}>
                <span className="size-2 rounded-full" style={{ backgroundColor: g.color }} />
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3 space-y-3 border-t pt-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2.5 text-[15px]">
            <Switch
              className={figmaSwitch}
              checked={character.has_ring}
              onCheckedChange={(on) => actions.requestRingHolder(on ? character.id : null)}
            />
            Has Ring
          </label>
          <label className="flex items-center gap-2.5 text-[15px]">
            <Switch
              className={figmaSwitch}
              checked={character.army_mobilized}
              onCheckedChange={(army_mobilized) => update({ id: character.id, body: { army_mobilized } })}
            />
            Army Mobilized
          </label>
        </div>
        <div>
          <div className="flex items-baseline justify-between text-[13px]">
            <span>Corruption Level</span>
            {character.accruing && corruption < 100 ? (
              <span className="text-muted-foreground text-[11px]">
                rising {(2 * character.corruption_a * Math.sqrt(corruption / character.corruption_a)).toFixed(1)}%/hr now
              </span>
            ) : null}
          </div>
          <Slider
            className="mt-2"
            min={0}
            max={100}
            step={1}
            value={[draft ?? corruption]}
            onValueChange={([v]) => setDraft(v)}
            onValueCommit={([v]) =>
              update(
                { id: character.id, body: { corruption: v } },
                { onSettled: () => setDraft(null) }
              )
            }
            aria-label="Corruption level"
          />
          <p className="mt-1 text-right text-[13px] tabular-nums">{Math.floor(draft ?? corruption)}%</p>
          <CorruptionCurve character={character} value={draft ?? corruption} />
        </div>
      </div>

      <div className="mt-2 space-y-2.5 border-t pt-3">
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2.5 text-[15px]">
            <Checkbox checked={!!conflict} disabled aria-readonly className="data-disabled:opacity-100" />
            In Conflict?
          </label>
          <span className="truncate text-xs italic">
            {conflict ? conflict.name + (ongoing.length > 1 ? ` +${ongoing.length - 1}` : "") : "Not in conflict"}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <Button
            variant="outline"
            className={cn(outlineButton, "flex-1 px-0")}
            disabled={!conflict}
            onClick={() => conflict && actions.openResolveConflict(conflict)}
          >
            Resolve
          </Button>
          <Button
            variant="outline"
            className={cn(outlineButton, "flex-1 px-0")}
            disabled={!conflict}
            onClick={() => conflict && navigate({ tab: "conflict", conflict: conflict.id })}
          >
            View
          </Button>
          <Button
            className={cn(solidButton, "flex-1 px-0")}
            onClick={() => actions.openCreateConflict({ partyIds: [character.id] })}
          >
            Create
          </Button>
          <Button className={cn(dangerButton, "flex-1 px-0")} disabled={!conflict} onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        </div>
      </div>

      <section className="mt-3 border-t pt-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg leading-7 font-semibold tracking-tight">Crisis Notes</h3>
          <div className="flex gap-1">
            <NoteFilterButton value={filter} onChange={setFilter} />
            <Button
              className={cn(solidButton, "w-[70px]")}
              onClick={() => actions.openAddNote({ authorIds: [character.id] })}
            >
              Create
            </Button>
          </div>
        </div>
        <div className="mt-2">
          <NoteList notes={filtered} loading={notesLoading} empty="No crisis notes for this character yet." />
        </div>
      </section>

      <MovementHistory characterId={character.id} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{conflict?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The conflict is removed for every party. Notes already logged about it are kept. Use
              Resolve instead if it ended in the story.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => conflict && deleteConflict(conflict.id, { onSuccess: () => setConfirmDelete(false) })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MovementHistory({ characterId }: { characterId: number }) {
  const [open, setOpen] = useState(false);
  const { data: movements = [] } = useMovements(open ? characterId : null);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-4 border-t pt-3">
      <CollapsibleTrigger className="flex w-full items-center justify-between text-left text-sm font-semibold">
        Movement history
        <ChevronRightIcon className={cn("size-4 transition-transform", open && "rotate-90")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {movements.length ? (
          <ol className="mt-2 space-y-2">
            {movements.map((m) => (
              <li key={m.id} className="border-primary border-l-2 pl-2 text-xs">
                <p className="font-medium">
                  {m.from_region_name ?? (m.from_x == null ? "Placed" : "Uncharted")} → {m.to_region_name ?? "Uncharted"}
                </p>
                <p className="text-muted-foreground">
                  {format(new Date(m.created_at), "MMM d, h:mm a")}
                  {m.note_title ? ` · ${m.note_title}` : ""}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground mt-2 text-xs">No moves yet.</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * The character's corruption curve (a × hours²) with where they are on it,
 * and the editable steepness "a" — a small a is a slow burn, a big one is fast.
 */
function CorruptionCurve({ character, value }: { character: MapCharacter; value: number }) {
  const { data: game } = useGameState();
  const { mutate: update } = useUpdateCharacter();
  const a = character.corruption_a;
  const raceDefault = game?.race_curve_a[character.race];
  const [draftA, setDraftA] = useState(String(a));
  useEffect(() => setDraftA(String(a)), [a]);

  const fullAt = Math.sqrt(100 / a);
  const held = Math.sqrt(Math.max(0, value) / a);
  const W = 300;
  const H = 56;
  const points = Array.from({ length: 41 }, (_, i) => {
    const h = (fullAt * i) / 40;
    return `${(h / fullAt) * W},${H - (a * h * h * H) / 100}`;
  }).join(" ");

  function commit() {
    const next = Number(draftA);
    if (Number.isFinite(next) && next > 0 && next !== a) {
      update({ id: character.id, body: { corruption_a: next } });
    } else {
      setDraftA(String(a));
    }
  }

  return (
    <div className="bg-muted/50 mt-2 rounded-lg p-2.5">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-full overflow-visible" aria-hidden>
        <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <circle
          cx={(Math.min(held, fullAt) / fullAt) * W}
          cy={H - (Math.min(value, 100) * H) / 100}
          r={4}
          fill="#ff6600"
          stroke="white"
          strokeWidth={1.5}
        />
      </svg>
      <div className="text-muted-foreground mt-1.5 flex items-center justify-between gap-2 text-[11px]">
        <span>
          {held.toFixed(1)} h held · fully corrupted at {fullAt.toFixed(1)} h
        </span>
        <label className="flex items-center gap-1">
          a =
          <Input
            type="number"
            step={0.1}
            min={0.1}
            value={draftA}
            onChange={(e) => setDraftA(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="h-6 w-14 px-1.5 text-[11px] md:text-[11px]"
            aria-label="Corruption curve steepness"
          />
        </label>
      </div>
      {character.corruption_a_is_custom && raceDefault != null ? (
        <button
          type="button"
          className="text-primary mt-1 text-[11px] hover:underline"
          onClick={() => update({ id: character.id, body: { corruption_a: null } })}
        >
          Reset to {raceLabel(character.race)} default ({raceDefault})
        </button>
      ) : null}
    </div>
  );
}
