"use client";

import { XIcon } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CharacterResponse } from "@/types/api";

/**
 * The design's multi-pick: a plain select that adds to a list of removable
 * chips shown underneath it ("x Nuth  x Buth").
 */
export function CharacterMultiSelect({
  characters,
  value,
  onChange,
  placeholder = "Select option",
  id,
}: {
  characters: CharacterResponse[];
  value: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  id?: string;
}) {
  const remaining = characters.filter((c) => !value.includes(c.id));
  const byId = new Map(characters.map((c) => [c.id, c]));
  return (
    <div className="space-y-1">
      <Select value="" onValueChange={(v) => onChange([...value, Number(v)])}>
        <SelectTrigger id={id} className="data-[size=default]:h-10 w-full text-xs" disabled={!remaining.length}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {remaining.map((c) => (
            <SelectItem key={c.id} value={String(c.id)}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value.length ? (
        <div className="flex flex-wrap gap-1">
          {value.map((cid) => (
            <button
              key={cid}
              type="button"
              onClick={() => onChange(value.filter((v) => v !== cid))}
              className="bg-muted-foreground inline-flex items-center gap-0.5 rounded-sm px-1 text-[10px] leading-4 text-white hover:opacity-80"
              aria-label={`Remove ${byId.get(cid)?.name ?? "character"}`}
            >
              <XIcon className="size-2.5" />
              {byId.get(cid)?.name ?? `#${cid}`}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
