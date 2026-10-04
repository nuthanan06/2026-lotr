"use client";

import { useEffect, useState } from "react";

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
import { useGameState, useMapCharacters, useSetRingHolder, useUpdateCharacter } from "@/hooks/useMap";
import type { MapCharacter } from "@/types/api";
import { RACE_LABELS, raceLabel } from "./parts";

/**
 * Confirms a Ring hand-off. The warning matters: whoever takes the Ring
 * starts accruing corruption immediately.
 */
export function RingHolderDialog({
  targetId,
  onOpenChange,
}: {
  /** The new holder's id, null to take the Ring from everyone, undefined when closed. */
  targetId: number | null | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: characters = [] } = useMapCharacters();
  const { data: game } = useGameState();
  const { mutate, isPending } = useSetRingHolder();
  const open = targetId !== undefined;
  const target = characters.find((c) => c.id === targetId);
  const current = characters.find((c) => c.id === game?.ring_holder_id);
  // Hours of holding left before they're fully corrupted on their curve.
  const hoursToFull = target
    ? Math.max(0, Math.sqrt(100 / target.corruption_a) - target.ring_hours)
    : 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {target ? `Give the One Ring to ${target.name}?` : `Take the Ring from ${current?.name ?? "its holder"}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {target ? (
              <>
                {current ? `${current.name} will no longer hold it and their corruption stops rising. ` : ""}
                {target.name}&apos;s corruption will start rising, slowly at first and then faster
                (curve a = {target.corruption_a}, {raceLabel(target.race)}). At this rate they are fully
                corrupted after about {hoursToFull.toFixed(1)} more hours holding it.
                {game?.clock_paused ? " The corruption clock is currently paused." : ""}
              </>
            ) : (
              "Nobody will hold the Ring, and corruption stops rising for everyone."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={() => mutate(targetId ?? null, { onSuccess: () => onOpenChange(false) })}
          >
            {target ? "Give the Ring" : "Take the Ring"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function EditCharacterDialog({
  character,
  onOpenChange,
}: {
  character: MapCharacter | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { mutate, isPending } = useUpdateCharacter();
  const [name, setName] = useState("");
  const [race, setRace] = useState("MAN");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (character) {
      setName(character.name);
      setRace(character.race);
      setAvatarUrl(character.avatar_url ?? "");
    }
  }, [character]);

  return (
    <Dialog open={!!character} onOpenChange={onOpenChange}>
      {character ? (
        <DialogContent className="rounded-[20px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Edit character</DialogTitle>
            <DialogDescription>Race sets how fast the Ring corrupts them.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              mutate(
                {
                  id: character.id,
                  body: { name: name.trim(), race, avatar_url: avatarUrl.trim() || null },
                },
                { onSuccess: () => onOpenChange(false) }
              );
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="char-name" className="text-xs">
                Name
              </Label>
              <Input id="char-name" value={name} onChange={(e) => setName(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="char-race" className="text-xs">
                Race
              </Label>
              <Select value={race} onValueChange={setRace}>
                <SelectTrigger id="char-race" className="data-[size=default]:h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RACE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="char-avatar" className="text-xs">
                Portrait image URL
              </Label>
              <Input
                id="char-avatar"
                type="url"
                placeholder="https://…"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="h-10"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Back
              </Button>
              <Button type="submit" disabled={!name.trim() || isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
