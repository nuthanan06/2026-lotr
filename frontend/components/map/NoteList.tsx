"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CrisisNoteResponse, NoteType, Priority } from "@/types/api";
import { useMapActions } from "./MapActions";
import { formatSubmitted, noteAuthors } from "./NoteDialogs";
import {
  NoteTags,
  SidebarPagination,
  joinNames,
  outlineButton,
  usePaged,
} from "./parts";

export function NoteCard({ note }: { note: CrisisNoteResponse }) {
  const { openNote } = useMapActions();
  return (
    <article className="bg-background relative rounded-sm border border-[#d9d9d9] px-3 pt-2.5 pb-2 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs leading-4 font-bold">{note.title}</h3>
        <p className="shrink-0 pt-px text-[8px] whitespace-nowrap italic">{formatSubmitted(note.created_at)}</p>
      </div>
      <p className="mt-0.5 text-[8px] italic">By: {joinNames(noteAuthors(note))}</p>
      <div className="mt-1">
        <NoteTags note={note} />
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-3">
        <p className="line-clamp-3 max-w-[204px] text-[10px] leading-snug">{note.description}</p>
        <Button
          className="h-4 w-[51px] shrink-0 rounded-lg px-4 text-[10px]"
          onClick={() => openNote(note)}
        >
          View
        </Button>
      </div>
    </article>
  );
}

interface NoteFilterState {
  priority: Priority | "ALL";
  type: NoteType | "ALL";
}

const ALL: NoteFilterState = { priority: "ALL", type: "ALL" };

export function NoteFilterButton({
  value,
  onChange,
}: {
  value: NoteFilterState;
  onChange: (value: NoteFilterState) => void;
}) {
  const active = value.priority !== "ALL" || value.type !== "ALL";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn(outlineButton, "w-[66px]", active && "border-primary")}>
          Filter
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Tag</Label>
          <Select value={value.priority} onValueChange={(v) => onChange({ ...value, priority: v as NoteFilterState["priority"] })}>
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All tags</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={value.type} onValueChange={(v) => onChange({ ...value, type: v as NoteFilterState["type"] })}>
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              <SelectItem value="PRIVATE_DIRECTIVE">Private directive</SelectItem>
              <SelectItem value="PUBLIC_DIRECTIVE">Public directive</SelectItem>
              <SelectItem value="CRISIS_UPDATE">Crisis update</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {active ? (
          <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange(ALL)}>
            Clear filters
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export function useNoteFilter(notes: CrisisNoteResponse[], query = "") {
  const [filter, setFilter] = useState<NoteFilterState>(ALL);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter(
      (n) =>
        (filter.priority === "ALL" || n.priority === filter.priority) &&
        (filter.type === "ALL" || n.note_type === filter.type) &&
        (!q ||
          n.title.toLowerCase().includes(q) ||
          n.description.toLowerCase().includes(q) ||
          noteAuthors(n).some((a) => a.name.toLowerCase().includes(q)))
    );
  }, [notes, filter, query]);
  return { filter, setFilter, filtered };
}

export function NoteList({
  notes,
  pageSize = 3,
  empty = "No crisis notes yet.",
  loading = false,
}: {
  notes: CrisisNoteResponse[];
  pageSize?: number;
  empty?: string;
  loading?: boolean;
}) {
  const { page, pageCount, setPage, pageItems } = usePaged(notes, pageSize);
  if (loading) return <p className="text-muted-foreground py-4 text-center text-xs">Loading…</p>;
  if (!notes.length) return <p className="text-muted-foreground py-4 text-center text-xs">{empty}</p>;
  return (
    <div className="space-y-2.5">
      {pageItems.map((n) => (
        <NoteCard key={n.id} note={n} />
      ))}
      <SidebarPagination page={page} pageCount={pageCount} onPage={setPage} />
    </div>
  );
}
