"use client";

import { createContext, useContext, useMemo, useState } from "react";

import type { ConflictResponse, CrisisNoteResponse, MapCharacter } from "@/types/api";
import type { MapPoint } from "@/lib/mapGeo";
import { EditCharacterDialog, RingHolderDialog } from "./CharacterDialogs";
import {
  CreateConflictDialog,
  ResolveConflictDialog,
  type ConflictPrefill,
} from "./ConflictDialogs";
import { MoveCharacterDialog, type MoveRequestState } from "./MoveCharacterDialog";
import { CrisisNoteDialog, NoteDetailDialog, type NotePrefill } from "./NoteDialogs";
import { TimedCrisisWatcher } from "./TimedCrisisWatcher";
import { useMapParams } from "./useMapParams";

interface MapActions {
  requestMove: (character: MapCharacter, destination: MapPoint, onCancel?: () => void) => void;
  openAddNote: (prefill?: NotePrefill) => void;
  openNote: (note: CrisisNoteResponse) => void;
  openCreateConflict: (prefill?: ConflictPrefill) => void;
  openResolveConflict: (conflict: ConflictResponse) => void;
  requestRingHolder: (characterId: number | null) => void;
  openEditCharacter: (character: MapCharacter) => void;
  /** Pan/zoom the map to a point (the "View" buttons). */
  focusMap: (point: MapPoint) => void;
}

const MapActionsContext = createContext<MapActions | null>(null);
// A fresh object per request so focusing the same point twice still fires.
const MapFocusContext = createContext<{ point: MapPoint } | null>(null);

export function useMapFocus() {
  return useContext(MapFocusContext);
}

/** For components that also render on the read-only delegate screen. */
export function useOptionalMapActions() {
  return useContext(MapActionsContext);
}

export function useMapActions() {
  const ctx = useContext(MapActionsContext);
  if (!ctx) throw new Error("useMapActions must be used inside <MapActionsProvider>");
  return ctx;
}

/**
 * Owns every map workflow dialog so the map canvas and the sidebar can both
 * start the same flows (moving, notes, conflicts, the Ring).
 */
export function MapActionsProvider({ children }: { children: React.ReactNode }) {
  const { navigate } = useMapParams();
  const [move, setMove] = useState<MoveRequestState | null>(null);
  const [notePrefill, setNotePrefill] = useState<NotePrefill | null>(null);
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [viewNote, setViewNote] = useState<CrisisNoteResponse | null>(null);
  const [conflictPrefill, setConflictPrefill] = useState<ConflictPrefill | null>(null);
  const [createConflictOpen, setCreateConflictOpen] = useState(false);
  const [resolving, setResolving] = useState<ConflictResponse | null>(null);
  const [ringTarget, setRingTarget] = useState<number | null | undefined>(undefined);
  const [editing, setEditing] = useState<MapCharacter | null>(null);
  const [focus, setFocus] = useState<{ point: MapPoint } | null>(null);

  const actions = useMemo<MapActions>(
    () => ({
      requestMove: (character, destination, onCancel) => setMove({ character, destination, onCancel }),
      openAddNote: (prefill) => {
        setNotePrefill(prefill ?? null);
        setAddNoteOpen(true);
      },
      openNote: setViewNote,
      openCreateConflict: (prefill) => {
        setConflictPrefill(prefill ?? null);
        setCreateConflictOpen(true);
      },
      openResolveConflict: setResolving,
      requestRingHolder: setRingTarget,
      openEditCharacter: setEditing,
      focusMap: (point) => setFocus({ point }),
    }),
    []
  );

  return (
    <MapActionsContext.Provider value={actions}>
      <MapFocusContext.Provider value={focus}>{children}</MapFocusContext.Provider>
      <MoveCharacterDialog request={move} onClose={() => setMove(null)} />
      <CrisisNoteDialog
        open={addNoteOpen}
        prefill={notePrefill}
        onOpenChange={setAddNoteOpen}
        onCreated={(note) => {
          // A directive that starts a conflict goes straight into conflict creation.
          if (note.action === "CONFLICT" && !note.conflict_id) {
            actions.openCreateConflict({
              partyIds: [...new Set([note.character.id, ...note.authors.map((a) => a.id), ...note.targets.map((t) => t.id)])],
              noteId: note.id,
            });
          }
        }}
      />
      <NoteDetailDialog note={viewNote} onOpenChange={(open) => !open && setViewNote(null)} />
      <CreateConflictDialog
        open={createConflictOpen}
        prefill={conflictPrefill}
        onOpenChange={setCreateConflictOpen}
        onCreated={(conflict) => navigate({ tab: "conflict", conflict: conflict.id })}
      />
      <TimedCrisisWatcher onResolveConflict={setResolving} />
      <ResolveConflictDialog conflict={resolving} onOpenChange={(open) => !open && setResolving(null)} />
      <RingHolderDialog targetId={ringTarget} onOpenChange={(open) => !open && setRingTarget(undefined)} />
      <EditCharacterDialog character={editing} onOpenChange={(open) => !open && setEditing(null)} />
    </MapActionsContext.Provider>
  );
}
