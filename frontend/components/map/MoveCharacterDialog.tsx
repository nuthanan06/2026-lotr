"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useNotes } from "@/hooks/useCrisisNotes";
import { useActivePeriod } from "@/hooks/useCrisisPeriods";
import { useGroups, useMoveCharacter, useRegions } from "@/hooks/useMap";
import { knownTo, regionAt, type MapPoint } from "@/lib/mapGeo";
import type { MapCharacter, MoveRequest, Priority } from "@/types/api";

export interface MoveRequestState {
  character: MapCharacter;
  destination: MapPoint;
  /** Called if the move is abandoned, so a dragged pin can snap back. */
  onCancel?: () => void;
}

/**
 * Every move needs a crisis note (existing or new) before it goes through;
 * moving into an undiscovered region then asks whether to reveal it.
 */
export function MoveCharacterDialog({
  request,
  onClose,
}: {
  request: MoveRequestState | null;
  onClose: () => void;
}) {
  const { data: regions = [] } = useRegions();
  const { data: groups = [] } = useGroups();
  const { data: period } = useActivePeriod();
  const character = request?.character;
  const { data: notes = [] } = useNotes(
    { period_id: period?.id, character_id: character?.id },
    !!period && !!character
  );
  const { mutate, isPending } = useMoveCharacter();

  const [step, setStep] = useState<"note" | "discover">("note");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [noteId, setNoteId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");

  useEffect(() => {
    if (!request) return;
    setStep("note");
    setMode("new");
    setNoteId("");
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
  }, [request]);

  const destination = useMemo(
    () => (request ? regionAt(regions, request.destination) : null),
    [regions, request]
  );

  const moverGroup = groups.find((g) => g.id === request?.character.group_id);
  // Discovery is per group: new to the mover's group even if others found it.
  const knownToMover = !!destination && knownTo(destination, request?.character.group_id);
  const noteValid = mode === "existing" ? !!noteId : !!period && !!title.trim() && !!description.trim();

  function cancel() {
    request?.onCancel?.();
    onClose();
  }

  function submit(discover: boolean) {
    if (!request) return;
    const body: MoveRequest = {
      ...request.destination,
      discover_region: discover,
      ...(mode === "existing"
        ? { note_id: Number(noteId) }
        : { note: { title: title.trim(), description: description.trim(), priority } }),
    };
    mutate({ id: request.character.id, body }, { onSuccess: onClose });
  }

  function next() {
    if (!noteValid) return;
    if (destination && !knownToMover) setStep("discover");
    else submit(false);
  }

  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && cancel()}>
      {request ? (
        <DialogContent className="rounded-[20px] sm:max-w-md">
          {step === "note" ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Move {request.character.name}</DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-1.5">
                  To {destination?.name ?? "uncharted lands"}
                  {destination && !knownToMover ? (
                    <Badge variant="secondary">New to {moverGroup?.name ?? "them"}</Badge>
                  ) : null}
                </DialogDescription>
              </DialogHeader>
              <ToggleGroup
                type="single"
                variant="outline"
                value={mode}
                onValueChange={(v) => v && setMode(v as "new" | "existing")}
                className="w-full"
              >
                <ToggleGroupItem value="new" className="flex-1 text-xs">
                  Write new note
                </ToggleGroupItem>
                <ToggleGroupItem value="existing" className="flex-1 text-xs" disabled={!notes.length}>
                  Use existing note
                </ToggleGroupItem>
              </ToggleGroup>

              {mode === "existing" ? (
                <div className="space-y-1">
                  <Label htmlFor="move-note" className="text-xs">
                    Crisis note
                  </Label>
                  <Select value={noteId} onValueChange={setNoteId}>
                    <SelectTrigger id="move-note" className="data-[size=default]:h-10 w-full text-xs">
                      <SelectValue placeholder="Select a note" />
                    </SelectTrigger>
                    <SelectContent>
                      {notes.map((n) => (
                        <SelectItem key={n.id} value={String(n.id)}>
                          {n.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-[1fr_120px] gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="move-title" className="text-xs">
                        Crisis Note Name
                      </Label>
                      <Input
                        id="move-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="March to Helm's Deep"
                        className="h-10 text-xs md:text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="move-priority" className="text-xs">
                        Tag
                      </Label>
                      <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                        <SelectTrigger id="move-priority" className="data-[size=default]:h-10 w-full text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="LOW">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="move-description" className="text-xs">
                      Crisis Note Description
                    </Label>
                    <Textarea
                      id="move-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="h-20 text-xs md:text-xs"
                    />
                  </div>
                  {!period ? (
                    <p className="text-destructive text-xs">
                      No active crisis update — start one on the Directives tab, or cite an existing note.
                    </p>
                  ) : null}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={cancel}>
                  Cancel
                </Button>
                <Button onClick={next} disabled={!noteValid || isPending}>
                  {isPending ? "Moving…" : "Move"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Discover {destination?.name}?</DialogTitle>
                <DialogDescription>
                  New to {moverGroup?.name ?? "this group"}. Revealed at the next crisis update.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="sm:justify-between">
                <Button variant="ghost" onClick={() => setStep("note")} disabled={isPending}>
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => submit(false)} disabled={isPending}>
                    Keep it undiscovered
                  </Button>
                  <Button onClick={() => submit(true)} disabled={isPending}>
                    Mark discovered &amp; move
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
