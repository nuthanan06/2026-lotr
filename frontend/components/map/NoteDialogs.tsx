"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";

import { EditNoteSheet } from "@/components/crisis/EditNoteSheet";
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
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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
import { useCreateNote, useDeleteNote, useUpdateNote } from "@/hooks/useCrisisNotes";
import { useActivePeriod } from "@/hooks/useCrisisPeriods";
import { useMapCharacters } from "@/hooks/useMap";
import { cn } from "@/lib/utils";
import type { CrisisNoteResponse, NoteAction, NoteType, Priority } from "@/types/api";
import { CharacterMultiSelect } from "./CharacterMultiSelect";
import { NoteTags, dangerButton, joinNames, outlineButton, solidButton } from "./parts";

/** Push a deadline back by `minutes`, counting from now if it already passed. */
export function extendDeadline(deadline: string | null, minutes: number) {
  const from = Math.max(Date.now(), deadline ? Date.parse(deadline) : 0);
  return new Date(from + minutes * 60_000).toISOString();
}

export const NO_TIMER = "none";
const TIMER_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120];

/** Pick a countdown for a timed crisis; staff get a popup if it runs out unresolved. */
export function TimerSelect({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="data-[size=default]:h-10 w-full text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_TIMER}>No timer</SelectItem>
        {TIMER_OPTIONS.map((m) => (
          <SelectItem key={m} value={String(m)}>
            {m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? "" : "s"}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export interface NotePrefill {
  authorIds?: number[];
  targetIds?: number[];
  action?: NoteAction;
  conflictId?: number;
}

export const ACTION_LABELS: Record<NoteAction, string> = {
  NONE: "No map action",
  MOVE: "Move",
  MOBILIZE: "Mobilize army",
  CONFLICT: "Start conflict",
  RING: "Ring",
};

export function noteAuthors(note: CrisisNoteResponse) {
  return [note.character, ...note.authors];
}

export function formatSubmitted(iso: string) {
  return `Submitted ${format(new Date(iso), "MM/dd/yy h:mm a")}`;
}

const label = "text-xs leading-4 font-normal";

/** "Add Crisis Note/Update" — the design's directive creation modal. */
export function CrisisNoteDialog({
  open,
  prefill,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  prefill: NotePrefill | null;
  onOpenChange: (open: boolean) => void;
  onCreated?: (note: CrisisNoteResponse) => void;
}) {
  const { data: characters = [] } = useMapCharacters();
  const { data: period } = useActivePeriod();
  const { mutate, isPending } = useCreateNote();

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [authorIds, setAuthorIds] = useState<number[]>([]);
  const [description, setDescription] = useState("");
  const [staffNotes, setStaffNotes] = useState("");
  const [action, setAction] = useState<NoteAction>("NONE");
  const [targetIds, setTargetIds] = useState<number[]>([]);
  const [noteType, setNoteType] = useState<NoteType>("PRIVATE_DIRECTIVE");
  const [timer, setTimer] = useState(NO_TIMER);

  useEffect(() => {
    if (!open) return;
    // Notes logged against a conflict default to staff updates.
    setNoteType(prefill?.conflictId ? "CRISIS_UPDATE" : "PRIVATE_DIRECTIVE");
    setTimer(NO_TIMER);
    setTitle("");
    setPriority("");
    setDescription("");
    setStaffNotes("");
    setAuthorIds(prefill?.authorIds ?? []);
    setTargetIds(prefill?.targetIds ?? []);
    setAction(prefill?.action ?? "NONE");
  }, [open, prefill]);

  const valid = !!period && !!title.trim() && !!description.trim() && !!priority && authorIds.length > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !period) return;
    const [primary, ...coAuthors] = authorIds;
    mutate(
      {
        character_id: primary,
        period_id: period.id,
        title: title.trim(),
        description: description.trim(),
        crisis_staff_notes: staffNotes.trim() || undefined,
        priority: priority as Priority,
        note_type: noteType,
        action,
        conflict_id: prefill?.conflictId,
        author_ids: coAuthors,
        target_ids: targetIds,
        timer_minutes: timer === NO_TIMER ? undefined : Number(timer),
      },
      {
        onSuccess: (note) => {
          onOpenChange(false);
          onCreated?.(note);
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[20px] px-6 pt-6 pb-5 sm:max-w-[515px]">
        <DialogTitle className="text-2xl leading-8 font-bold">Add Crisis Note/Update</DialogTitle>
        <DialogDescription className="sr-only">
          Log a directive or crisis update against one or more characters.
        </DialogDescription>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="note-title" className={cn(label, "font-medium")}>
              Crisis Note Name
            </Label>
            <Input
              id="note-title"
              placeholder="Input Value"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10 max-w-[340px] text-xs md:text-xs"
            />
          </div>

          <div className="grid max-w-[398px] grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="note-tag" className={label}>
                Tag
              </Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger id="note-tag" className="data-[size=default]:h-10 w-full text-xs">
                  <SelectValue placeholder="Select option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="note-authors" className={label}>
                Authors
              </Label>
              <CharacterMultiSelect
                id="note-authors"
                characters={characters}
                value={authorIds}
                onChange={setAuthorIds}
              />
            </div>
          </div>

          <div className="grid max-w-[398px] grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="note-type" className={label}>
                Visibility
              </Label>
              <Select value={noteType} onValueChange={(v) => setNoteType(v as NoteType)}>
                <SelectTrigger id="note-type" className="data-[size=default]:h-10 w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIVATE_DIRECTIVE">Private directive</SelectItem>
                  <SelectItem value="PUBLIC_DIRECTIVE">Public directive</SelectItem>
                  <SelectItem value="CRISIS_UPDATE">Crisis update</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="note-timer" className={label}>
                Timed crisis
              </Label>
              <TimerSelect id="note-timer" value={timer} onChange={setTimer} />
            </div>
          </div>

          <div className="max-w-[398px] space-y-1">
            <Label htmlFor="note-description" className={label}>
              Crisis Note Description
            </Label>
            <Textarea
              id="note-description"
              placeholder="Input Value"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-20 text-xs md:text-xs"
            />
          </div>

          <div className="max-w-[398px] space-y-1">
            <Label htmlFor="note-staff" className={label}>
              Crisis Staff Notes
            </Label>
            <Textarea
              id="note-staff"
              placeholder="Input Value"
              value={staffNotes}
              onChange={(e) => setStaffNotes(e.target.value)}
              className="h-20 text-xs md:text-xs"
            />
          </div>

          <div className="grid max-w-[440px] grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="note-action" className={label}>
                Action
              </Label>
              <Select value={action} onValueChange={(v) => setAction(v as NoteAction)}>
                <SelectTrigger id="note-action" className="data-[size=default]:h-10 w-full text-xs">
                  <SelectValue placeholder="Select option" />
                </SelectTrigger>
                <SelectContent>
                  {(["NONE", "MOVE", "MOBILIZE", "CONFLICT"] as NoteAction[]).map((a) => (
                    <SelectItem key={a} value={a}>
                      {ACTION_LABELS[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="note-targets" className={label}>
                Conflict With/Assigned to?
              </Label>
              <CharacterMultiSelect
                id="note-targets"
                characters={characters}
                value={targetIds}
                onChange={setTargetIds}
              />
            </div>
          </div>

          {!period ? (
            <p className="text-destructive text-xs">
              There is no active crisis update. Start one from the Directives tab first.
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className={cn(outlineButton, "w-[66px]")}
              onClick={() => onOpenChange(false)}
            >
              Back
            </Button>
            <Button type="submit" className={cn(solidButton, "h-[25px] w-[70px]")} disabled={!valid || isPending}>
              {isPending ? "Saving…" : "Done"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The design's "Directive View (On Click)" modal. */
export function NoteDetailDialog({
  note,
  onOpenChange,
}: {
  note: CrisisNoteResponse | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [editing, setEditing] = useState<CrisisNoteResponse | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { mutate: deleteNote, isPending } = useDeleteNote();
  const { mutate: updateNote, isPending: updating } = useUpdateNote();

  const extend = (n: CrisisNoteResponse) =>
    updateNote(
      { id: n.id, body: { deadline_at: extendDeadline(n.deadline_at, 5) } },
      { onSuccess: () => onOpenChange(false) }
    );

  return (
    <>
      <Dialog open={!!note} onOpenChange={onOpenChange}>
        {note ? (
          <DialogContent className="gap-3 rounded-[20px] px-7 pt-5 pb-4 sm:max-w-[571px]">
            <p className="text-[8px] italic">{formatSubmitted(note.created_at)}</p>
            <DialogTitle className="-mt-2 text-2xl leading-8 font-bold">{note.title}</DialogTitle>
            <DialogDescription className="text-foreground -mt-2 text-xs italic">
              By: {joinNames(noteAuthors(note))}
              {note.targets.length ? ` → ${joinNames(note.targets)}` : ""}
            </DialogDescription>
            <NoteTags note={note} />
            <div className="border-b pb-3">
              <p className="text-xs font-bold italic">Note Description</p>
              <p className="text-xs whitespace-pre-wrap italic">{note.description}</p>
            </div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold italic">Crisis Staff Notes</p>
                <p className="text-xs whitespace-pre-wrap italic">
                  {note.crisis_staff_notes || "—"}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {note.deadline_at && !note.resolved_at ? (
                  <Button
                    variant="outline"
                    className={outlineButton}
                    disabled={updating}
                    onClick={() => extend(note)}
                  >
                    +5 min
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  className={outlineButton}
                  disabled={updating}
                  onClick={() =>
                    updateNote(
                      { id: note.id, body: { resolved: !note.resolved_at } },
                      { onSuccess: () => onOpenChange(false) }
                    )
                  }
                >
                  {note.resolved_at ? "Reopen" : "Resolve"}
                </Button>
                <Button variant="outline" className={cn(outlineButton, "w-[66px]")} onClick={() => setEditing(note)}>
                  Edit
                </Button>
                <Button className={cn(dangerButton, "h-[25px] w-[70px]")} onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      <EditNoteSheet
        note={editing}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            onOpenChange(false);
          }
        }}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{note?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the note from every character&apos;s log. It can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() =>
                note &&
                deleteNote(note.id, {
                  onSuccess: () => {
                    setConfirmDelete(false);
                    onOpenChange(false);
                  },
                })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
