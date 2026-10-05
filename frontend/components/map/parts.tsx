"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckIcon,
  CircleDotIcon,
  FootprintsIcon,
  LockIcon,
  MegaphoneIcon,
  ScrollTextIcon,
  SearchIcon,
  ShieldIcon,
  SwordsIcon,
  TimerIcon,
  type LucideIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import type {
  CharacterResponse,
  CrisisNoteResponse,
  GroupResponse,
  MapCharacter,
  NoteType,
  Priority,
} from "@/types/api";

export const RACE_LABELS: Record<string, string> = {
  HOBBIT: "Hobbit",
  MAN: "Man",
  ELF: "Elf",
  DWARF: "Dwarf",
  WIZARD: "Wizard",
  ORC: "Orc",
  OTHER: "Other",
};

export function raceLabel(race: string) {
  return RACE_LABELS[race] ?? race;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

// Earthy tones that sit well on the parchment map; picked per name so a
// character keeps the same colour everywhere.
const AVATAR_COLORS = ["#7c4a2d", "#3f5e3a", "#44597a", "#7a3b3b", "#6b5a2e", "#3d5c5c", "#5b3f6b", "#8a5a1f"];

export function avatarColor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function CharacterAvatar({
  character,
  className,
}: {
  character: Pick<CharacterResponse, "name" | "avatar_url">;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-[30px] ring-2 ring-background", className)}>
      {character.avatar_url ? <AvatarImage src={character.avatar_url} alt="" /> : null}
      <AvatarFallback
        className="text-[0.7em] font-semibold tracking-wide text-white"
        style={{ backgroundColor: avatarColor(character.name) }}
      >
        {initials(character.name)}
      </AvatarFallback>
    </Avatar>
  );
}

/** 24px bold sidebar section title with the hand-drawn black rule under it. */
export function SectionHeading({
  title,
  children,
  className,
}: {
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-7 items-center justify-between gap-2", className)}>
      <h2 className="text-lg leading-7 font-semibold tracking-tight">{title}</h2>
      {children}
    </div>
  );
}

type TagTone = "red" | "coral" | "amber" | "gold" | "orange" | "teal" | "slate" | "outline";

const TAG_TONES: Record<TagTone, string> = {
  red: "bg-destructive text-white",
  coral: "bg-chart-1 text-white",
  amber: "bg-chart-4 text-white",
  gold: "bg-primary text-primary-foreground",
  orange: "bg-[#ff6600] text-white",
  teal: "bg-chart-2 text-white",
  slate: "bg-muted-foreground text-white",
  outline: "border-border bg-background text-foreground",
};

/** Small status pill used on note cards and character rows. */
export function Tag({
  tone,
  icon: Icon,
  children,
  className,
}: {
  tone: TagTone;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        "h-[18px] gap-0.5 rounded-md px-1.5 py-0 text-[10px] leading-4 font-semibold [&>svg]:size-2.5!",
        TAG_TONES[tone],
        className
      )}
    >
      {Icon ? <Icon /> : null}
      {children}
    </Badge>
  );
}

const PRIORITY_TAG: Record<Priority, { label: string; tone: TagTone }> = {
  HIGH: { label: "High", tone: "coral" },
  MEDIUM: { label: "Medium", tone: "amber" },
  LOW: { label: "Low", tone: "teal" },
};

export function PriorityTag({ priority }: { priority: Priority }) {
  const { label, tone } = PRIORITY_TAG[priority];
  return <Tag tone={tone}>{label}</Tag>;
}

export function ConflictTag() {
  return (
    <Tag tone="red" icon={SwordsIcon}>
      Conflict
    </Tag>
  );
}

/** Countdown pill for timed crises; turns red once the time is up. */
export function TimerTag({ deadline }: { deadline: string | null }) {
  const { label, overdue } = useCountdown(deadline);
  if (!label) return null;
  return (
    <Tag tone={overdue ? "red" : "slate"} icon={TimerIcon} className={cn(!overdue && "tabular-nums")}>
      {label}
    </Tag>
  );
}

/** Gold pill used for the race under a character's name. */
export function RaceBadge({ race, className }: { race: string; className?: string }) {
  return (
    <Badge className={cn("h-auto rounded-lg px-2 py-0.5 text-xs leading-4 font-normal", className)}>
      {raceLabel(race)}
    </Badge>
  );
}

export function SidebarSearch({
  value,
  onChange,
  placeholder = "Search",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-[34px] rounded-lg pr-8 text-xs md:text-xs"
      />
      <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2" />
    </div>
  );
}

/** Client-side paging for sidebar lists; snaps back when the list shrinks. */
export function usePaged<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const current = Math.min(page, pageCount);
  const pageItems = useMemo(
    () => items.slice((current - 1) * pageSize, current * pageSize),
    [items, current, pageSize]
  );
  return { page: current, pageCount, setPage, pageItems };
}

export function SidebarPagination({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  // Show first, current±1 and last, with ellipses for gaps — as in the design.
  const pages = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);
  const go = (p: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (p >= 1 && p <= pageCount) onPage(p);
  };
  return (
    <Pagination className="mt-2">
      <PaginationContent className="gap-2">
        <PaginationItem>
          <PaginationPrevious href="#" onClick={go(page - 1)} aria-disabled={page === 1} />
        </PaginationItem>
        {pages.map((p, i) => (
          <PaginationItem key={p} className="flex items-center gap-2">
            {i > 0 && p - pages[i - 1] > 1 ? <PaginationEllipsis /> : null}
            <PaginationLink href="#" isActive={p === page} onClick={go(p)} className="size-10">
              {p}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext href="#" onClick={go(page + 1)} aria-disabled={page === pageCount} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

/** Corruption extrapolated client-side between server refreshes, along the
 * character's curve a × hours_held². */
export function useLiveCorruption(character: MapCharacter | undefined) {
  const [now, setNow] = useState(() => Date.now());
  const accruing = !!character?.accruing && character.corruption < 100;
  useEffect(() => {
    if (!accruing) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [accruing]);
  if (!character) return 0;
  if (!character.accruing) return character.corruption;
  const hours = character.ring_hours + Math.max(0, (now - Date.parse(character.as_of)) / 3_600_000);
  return Math.min(100, character.corruption_a * hours * hours);
}

/** Live countdown to a deadline: "4:05", "1:02:03", or null once passed. */
export function useCountdown(deadline: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);
  if (!deadline) return { label: null, overdue: false };
  const ms = Date.parse(deadline) - now;
  if (ms <= 0) return { label: "Overdue", overdue: true };
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, "0");
  return { label: h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`, overdue: false };
}

export function joinNames(people: Pick<CharacterResponse, "name">[]) {
  return people.map((p) => p.name).join(", ");
}

// Solid action buttons from the design (h-6, rounded-lg, 14px medium).
export const solidButton = "h-6 rounded-lg px-4 text-sm";
export const dangerButton = cn(solidButton, "bg-destructive text-white hover:bg-destructive/90");
export const outlineButton = "h-[25px] rounded-lg px-4 text-sm shadow-xs";

const TYPE_TAG: Record<NoteType, { label: string; icon: LucideIcon }> = {
  PRIVATE_DIRECTIVE: { label: "Private", icon: LockIcon },
  PUBLIC_DIRECTIVE: { label: "Public", icon: MegaphoneIcon },
  CRISIS_UPDATE: { label: "Update", icon: ScrollTextIcon },
};

/** Every status pill a crisis note can carry, in a fixed order. */
export function NoteTags({ note }: { note: CrisisNoteResponse }) {
  const type = TYPE_TAG[note.note_type];
  return (
    <div className="flex flex-wrap gap-1">
      <PriorityTag priority={note.priority} />
      <Tag tone="outline" icon={type.icon}>
        {type.label}
      </Tag>
      {note.action === "CONFLICT" || note.conflict_id ? <ConflictTag /> : null}
      {note.action === "MOBILIZE" ? (
        <Tag tone="gold" icon={ShieldIcon}>
          Army
        </Tag>
      ) : null}
      {note.action === "MOVE" ? (
        <Tag tone="outline" icon={FootprintsIcon}>
          Move
        </Tag>
      ) : null}
      {note.action === "RING" ? (
        <Tag tone="orange" icon={CircleDotIcon}>
          Ring
        </Tag>
      ) : null}
      {note.resolved_at ? (
        <Tag tone="teal" icon={CheckIcon}>
          Resolved
        </Tag>
      ) : (
        <TimerTag deadline={note.deadline_at} />
      )}
    </div>
  );
}

/** Status pills for a character: Ring, Army, In conflict, group. */
export function CharacterTags({ character, group }: { character: MapCharacter; group?: GroupResponse }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <RaceBadge race={character.race} className="h-[18px] rounded-md px-1.5 py-0 text-[10px]" />
      {character.has_ring ? (
        <Tag tone="orange" icon={CircleDotIcon}>
          Ring
        </Tag>
      ) : null}
      {character.army_mobilized ? (
        <Tag tone="gold" icon={ShieldIcon}>
          Army
        </Tag>
      ) : null}
      {character.ongoing_conflict_ids.length ? (
        <Tag tone="red" icon={SwordsIcon}>
          In conflict
        </Tag>
      ) : null}
      {group ? <GroupTag group={group} /> : null}
    </div>
  );
}

export function GroupTag({ group }: { group: Pick<GroupResponse, "name" | "color"> }) {
  return (
    <Tag tone="outline">
      <span className="mr-0.5 size-2 rounded-full" style={{ backgroundColor: group.color }} />
      {group.name}
    </Tag>
  );
}
