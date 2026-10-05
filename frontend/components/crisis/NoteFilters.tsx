"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCharacters } from "@/hooks/useCharacters";
import type { NoteType, Priority } from "@/types/api";

interface FilterState {
  q: string;
  character_id: string;
  priority: string;
  note_type: string;
}

interface Props {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

export function NoteFilters({ filters, onChange }: Props) {
  const { data: characters } = useCharacters();
  const [searchInput, setSearchInput] = useState(filters.q);

  // Keep the latest filters/onChange in a ref so the debounce below always
  // merges into the current filters, not a stale snapshot from when the
  // timer was scheduled.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Debounce text search
  useEffect(() => {
    const t = setTimeout(
      () => onChangeRef.current({ ...filtersRef.current, q: searchInput }),
      300
    );
    return () => clearTimeout(t);
  }, [searchInput]);

  const hasFilters =
    !!filters.q || !!filters.character_id || !!filters.priority || !!filters.note_type;

  function clear() {
    setSearchInput("");
    onChange({ q: "", character_id: "", priority: "", note_type: "" });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search notes…"
        className="h-8 w-48"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
      />

      <Select
        value={filters.character_id || "__all__"}
        onValueChange={(v) => onChange({ ...filters, character_id: v === "__all__" ? "" : v })}
      >
        <SelectTrigger className="h-8 w-40">
          <SelectValue placeholder="All characters" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All characters</SelectItem>
          {characters?.map((c) => (
            <SelectItem key={c.id} value={String(c.id)}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.priority || "__all__"}
        onValueChange={(v) => onChange({ ...filters, priority: v === "__all__" ? "" : v })}
      >
        <SelectTrigger className="h-8 w-32">
          <SelectValue placeholder="All priorities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All priorities</SelectItem>
          <SelectItem value="HIGH">High</SelectItem>
          <SelectItem value="MEDIUM">Medium</SelectItem>
          <SelectItem value="LOW">Low</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.note_type || "__all__"}
        onValueChange={(v) => onChange({ ...filters, note_type: v === "__all__" ? "" : v })}
      >
        <SelectTrigger className="h-8 w-36">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All types</SelectItem>
          <SelectItem value="PRIVATE_DIRECTIVE">Private</SelectItem>
          <SelectItem value="PUBLIC_DIRECTIVE">Public</SelectItem>
          <SelectItem value="CRISIS_UPDATE">Crisis Update</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={clear}>
          <X className="mr-1 h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}

export type { FilterState };
