"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActivePeriod } from "@/hooks/useCrisisPeriods";
import { useCreateConflict, useMapCharacters, useResolveConflict } from "@/hooks/useMap";
import type { ConflictResponse } from "@/types/api";
import { CharacterMultiSelect } from "./CharacterMultiSelect";
import { NO_TIMER, TimerSelect } from "./NoteDialogs";

export interface ConflictPrefill {
  partyIds?: number[];
  noteId?: number;
}

export function CreateConflictDialog({
  open,
  prefill,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  prefill: ConflictPrefill | null;
  onOpenChange: (open: boolean) => void;
  onCreated?: (conflict: ConflictResponse) => void;
}) {
  const { data: characters = [] } = useMapCharacters();
  const { data: period } = useActivePeriod();
  const { mutate, isPending } = useCreateConflict();
  const [name, setName] = useState("");
  const [partyIds, setPartyIds] = useState<number[]>([]);
  const [timer, setTimer] = useState(NO_TIMER);

  useEffect(() => {
    if (open) {
      setName("");
      setTimer(NO_TIMER);
      setPartyIds(prefill?.partyIds ?? []);
    }
  }, [open, prefill]);

  const valid = !!period && !!name.trim() && partyIds.length >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[20px] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Create Conflict</DialogTitle>
          <DialogDescription>
            Every party is flagged “in conflict” and the start is logged in each of their notes.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            mutate(
              {
                name: name.trim(),
                party_ids: partyIds,
                note_id: prefill?.noteId,
                timer_minutes: timer === NO_TIMER ? undefined : Number(timer),
              },
              {
                onSuccess: (conflict) => {
                  onOpenChange(false);
                  onCreated?.(conflict);
                },
              }
            );
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="conflict-name" className="text-xs">
              Battle / conflict name
            </Label>
            <Input
              id="conflict-name"
              placeholder="Battle of the Hornburg"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 text-xs md:text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="conflict-parties" className="text-xs">
              Parties (two or more)
            </Label>
            <CharacterMultiSelect
              id="conflict-parties"
              characters={characters}
              value={partyIds}
              onChange={setPartyIds}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="conflict-timer" className="text-xs">
              Timed crisis
            </Label>
            <TimerSelect id="conflict-timer" value={timer} onChange={setTimer} />
            <p className="text-muted-foreground text-[11px]">
              Staff get a popup if it&apos;s still unresolved when the timer runs out.
            </p>
          </div>
          {!period ? (
            <p className="text-destructive text-xs">
              There is no active crisis update to log the conflict in. Start one from the Directives
              tab first.
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Back
            </Button>
            <Button type="submit" disabled={!valid || isPending}>
              {isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const NO_WINNER = "__none__";

export function ResolveConflictDialog({
  conflict,
  onOpenChange,
}: {
  conflict: ConflictResponse | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: period } = useActivePeriod();
  const { mutate, isPending } = useResolveConflict();
  const [winner, setWinner] = useState("");
  const [summary, setSummary] = useState("");

  useEffect(() => {
    setWinner("");
    setSummary("");
  }, [conflict]);

  const valid = !!period && !!winner && !!summary.trim();

  return (
    <Dialog open={!!conflict} onOpenChange={onOpenChange}>
      {conflict ? (
        <DialogContent className="rounded-[20px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Resolve {conflict.name}</DialogTitle>
            <DialogDescription>
              The outcome is pushed to the crisis notes of every party.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!valid) return;
              mutate(
                {
                  id: conflict.id,
                  body: {
                    winner_id: winner === NO_WINNER ? null : Number(winner),
                    outcome_summary: summary.trim(),
                  },
                },
                { onSuccess: () => onOpenChange(false) }
              );
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="conflict-winner" className="text-xs">
                Winner
              </Label>
              <Select value={winner} onValueChange={setWinner}>
                <SelectTrigger id="conflict-winner" className="data-[size=default]:h-10 w-full text-xs">
                  <SelectValue placeholder="Select option" />
                </SelectTrigger>
                <SelectContent>
                  {conflict.parties.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NO_WINNER}>No clear winner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="conflict-summary" className="text-xs">
                Outcome summary
              </Label>
              <Textarea
                id="conflict-summary"
                placeholder="What happened?"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="h-24 text-xs md:text-xs"
              />
            </div>
            {!period ? (
              <p className="text-destructive text-xs">
                There is no active crisis update to log the outcome in.
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Back
              </Button>
              <Button type="submit" disabled={!valid || isPending}>
                {isPending ? "Resolving…" : "Resolve"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
