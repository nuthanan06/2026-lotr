"use client";

import { useEffect, useMemo, useState } from "react";
import { TimerOffIcon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useNotes, useUpdateNote } from "@/hooks/useCrisisNotes";
import { useActivePeriod } from "@/hooks/useCrisisPeriods";
import { useConflicts, useUpdateConflict } from "@/hooks/useMap";
import type { ConflictResponse, CrisisNoteResponse } from "@/types/api";
import { extendDeadline } from "./NoteDialogs";
import { joinNames } from "./parts";

type Overdue =
  | { kind: "conflict"; key: string; item: ConflictResponse }
  | { kind: "note"; key: string; item: CrisisNoteResponse };

// Dismissals are per browser and per deadline, so extending a timer that
// then runs out again alerts again.
const STORAGE_KEY = "lotr:timed-crisis-dismissed";

function loadDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveDismissed(keys: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys].slice(-200)));
  } catch {
    // Storage unavailable (private mode) — dismissals just won't persist.
  }
}

/** Pops up when a timed crisis (conflict or note) runs out unresolved. */
export function TimedCrisisWatcher({ onResolveConflict }: { onResolveConflict: (c: ConflictResponse) => void }) {
  const { data: conflicts = [] } = useConflicts();
  const { data: period } = useActivePeriod();
  const { data: notes = [] } = useNotes({ period_id: period?.id }, !!period);
  const { mutate: updateConflict } = useUpdateConflict();
  const { mutate: updateNote } = useUpdateNote();
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  useEffect(() => setDismissed(loadDismissed()), []);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const overdue = useMemo<Overdue[]>(() => {
    const due = (deadline: string | null) => !!deadline && Date.parse(deadline) <= now;
    return [
      ...conflicts
        .filter((k) => k.status === "ONGOING" && due(k.deadline_at))
        .map((k) => ({ kind: "conflict" as const, key: `conflict:${k.id}:${k.deadline_at}`, item: k })),
      ...notes
        .filter((n) => !n.resolved_at && due(n.deadline_at))
        .map((n) => ({ kind: "note" as const, key: `note:${n.id}:${n.deadline_at}`, item: n })),
    ].filter((o) => !dismissed.has(o.key));
  }, [conflicts, notes, now, dismissed]);

  const current = overdue[0];

  function dismiss(key: string) {
    const next = new Set(dismissed).add(key);
    setDismissed(next);
    saveDismissed(next);
  }

  function extend() {
    if (!current) return;
    const deadline_at = extendDeadline(current.item.deadline_at, 5);
    if (current.kind === "conflict") updateConflict({ id: current.item.id, body: { deadline_at } });
    else updateNote({ id: current.item.id, body: { deadline_at } });
    dismiss(current.key);
  }

  function resolve() {
    if (!current) return;
    if (current.kind === "conflict") onResolveConflict(current.item);
    else updateNote({ id: current.item.id, body: { resolved: true } });
    dismiss(current.key);
  }

  return (
    <AlertDialog open={!!current}>
      {current ? (
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="bg-destructive/10 text-destructive mb-1 flex size-10 items-center justify-center rounded-full">
              <TimerOffIcon className="size-5" />
            </div>
            <AlertDialogTitle>Timed crisis not resolved</AlertDialogTitle>
            <AlertDialogDescription>
              The timer on {current.kind === "conflict" ? "the conflict" : "the crisis note"}{" "}
              <strong className="text-foreground">“{current.kind === "conflict" ? current.item.name : current.item.title}”</strong>{" "}
              ran out
              {current.kind === "conflict"
                ? ` while ${joinNames(current.item.parties)} were still fighting.`
                : " before it was resolved."}
              {overdue.length > 1 ? ` (${overdue.length - 1} more waiting.)` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => dismiss(current.key)}>
              Dismiss
            </Button>
            <Button variant="outline" onClick={extend}>
              +5 minutes
            </Button>
            <Button onClick={resolve}>{current.kind === "conflict" ? "Resolve conflict…" : "Mark resolved"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  );
}
