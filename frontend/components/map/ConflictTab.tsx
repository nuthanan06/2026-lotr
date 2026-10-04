"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CheckIcon, ChevronRightIcon } from "lucide-react";

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
import { useNotes } from "@/hooks/useCrisisNotes";
import { useConflicts, useDeleteConflict, useMapCharacters, useUpdateConflict } from "@/hooks/useMap";
import { centroid } from "@/lib/mapGeo";
import { cn } from "@/lib/utils";
import type { ConflictResponse } from "@/types/api";
import { BackArrow } from "./CharacterTab";
import { useMapActions } from "./MapActions";
import { NoteFilterButton, NoteList, useNoteFilter } from "./NoteList";
import { extendDeadline } from "./NoteDialogs";
import {
  CharacterAvatar,
  SectionHeading,
  SidebarPagination,
  SidebarSearch,
  Tag,
  TimerTag,
  dangerButton,
  joinNames,
  outlineButton,
  solidButton,
  usePaged,
} from "./parts";
import { useMapParams } from "./useMapParams";

export function ConflictTab() {
  const { conflictId } = useMapParams();
  return conflictId != null ? <ConflictDetail conflictId={conflictId} /> : <ConflictLists />;
}

function ConflictRow({ conflict }: { conflict: ConflictResponse }) {
  const { navigate } = useMapParams();
  return (
    <button
      type="button"
      onClick={() => navigate({ tab: "conflict", conflict: conflict.id })}
      className="bg-background hover:bg-muted/60 flex h-[58px] w-full items-center gap-2 rounded-sm border border-[#d9d9d9] pr-3 pl-1.5 text-left shadow-sm"
    >
      <span className="flex shrink-0 -space-x-4">
        {conflict.parties.slice(0, 2).map((p) => (
          <CharacterAvatar key={p.id} character={p} />
        ))}
      </span>
      <span className="min-w-0 flex-1 pl-1">
        <span className="block truncate text-base leading-6 font-semibold tracking-[-1px]">{conflict.name}</span>
        <span className="block truncate text-xs leading-4 font-light tracking-[-0.5px]">
          {joinNames(conflict.parties)}
        </span>
      </span>
      {conflict.status === "RESOLVED" ? (
        <Tag tone="teal" icon={CheckIcon}>
          Resolved
        </Tag>
      ) : (
        <TimerTag deadline={conflict.deadline_at} />
      )}
      <ChevronRightIcon className="size-6 shrink-0" />
    </button>
  );
}

function ConflictSection({
  title,
  conflicts,
  pageSize,
  action,
  empty,
}: {
  title: string;
  conflicts: ConflictResponse[];
  pageSize: number;
  action?: React.ReactNode;
  empty: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? conflicts.filter(
          (k) => k.name.toLowerCase().includes(q) || k.parties.some((p) => p.name.toLowerCase().includes(q))
        )
      : conflicts;
  }, [conflicts, query]);
  const { page, pageCount, setPage, pageItems } = usePaged(filtered, pageSize);

  return (
    <section>
      <SectionHeading title={title}>{action}</SectionHeading>
      <SidebarSearch value={query} onChange={setQuery} className="mt-5" />
      <ul className="mt-5 space-y-2.5">
        {pageItems.map((k) => (
          <li key={k.id}>
            <ConflictRow conflict={k} />
          </li>
        ))}
      </ul>
      {!filtered.length ? <p className="text-muted-foreground py-3 text-center text-xs">{empty}</p> : null}
      <SidebarPagination page={page} pageCount={pageCount} onPage={setPage} />
    </section>
  );
}

function ConflictLists() {
  const { data: conflicts = [] } = useConflicts();
  const { openCreateConflict } = useMapActions();
  return (
    <div className="space-y-6">
      <ConflictSection
        title="Ongoing Conflicts"
        conflicts={conflicts.filter((k) => k.status === "ONGOING")}
        pageSize={4}
        empty="No battles raging — for now."
        action={
          <Button className={cn(solidButton, "w-[77px]")} onClick={() => openCreateConflict()}>
            Create
          </Button>
        }
      />
      <ConflictSection
        title="Resolved Conflicts"
        conflicts={conflicts.filter((k) => k.status === "RESOLVED")}
        pageSize={3}
        empty="Nothing resolved yet."
      />
    </div>
  );
}

function ConflictDetail({ conflictId }: { conflictId: number }) {
  const { data: conflicts = [], isLoading } = useConflicts();
  const conflict = conflicts.find((k) => k.id === conflictId);
  const { back } = useMapParams();
  if (!conflict) {
    return (
      <div className="space-y-3">
        <BackArrow onClick={back} />
        <p className="text-muted-foreground text-sm">{isLoading ? "Loading…" : "Conflict not found."}</p>
      </div>
    );
  }
  return <ConflictDetailBody conflict={conflict} />;
}

function ConflictDetailBody({ conflict }: { conflict: ConflictResponse }) {
  const { navigate } = useMapParams();
  const actions = useMapActions();
  const { data: characters = [] } = useMapCharacters();
  const { data: notes = [], isLoading } = useNotes({ conflict_id: conflict.id });
  const { filter, setFilter, filtered } = useNoteFilter(notes);
  const { mutate: deleteConflict, isPending } = useDeleteConflict();
  const { mutate: updateConflict } = useUpdateConflict();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const ongoing = conflict.status === "ONGOING";
  const winner = conflict.parties.find((p) => p.id === conflict.winner_id);
  const placed = characters.filter(
    (c) => c.x != null && c.y != null && conflict.parties.some((p) => p.id === c.id)
  );

  return (
    <div>
      <BackArrow onClick={() => navigate({ tab: "conflict" })} label="All conflicts" />
      <header className="mt-1 flex items-start gap-3">
        <div className="grid shrink-0 grid-cols-2 gap-1.5">
          {conflict.parties.slice(0, 4).map((p) => (
            <CharacterAvatar key={p.id} character={p} className="size-[50px] ring-0" />
          ))}
        </div>
        <div className="min-w-0">
          <h2 className="text-2xl leading-8 font-bold">{conflict.name}</h2>
          <p className="text-sm leading-6">
            {conflict.parties.map((p, i) => (
              <span key={p.id}>
                {i > 0 ? ", " : ""}
                <button
                  type="button"
                  className="underline-offset-2 hover:underline"
                  onClick={() => navigate({ tab: "character", character: p.id })}
                >
                  {p.name}
                </button>
              </span>
            ))}
          </p>
        </div>
      </header>

      {ongoing && conflict.deadline_at ? (
        <div className="bg-muted mt-3 flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-xs">
          <span className="flex items-center gap-1.5">
            Timed crisis <TimerTag deadline={conflict.deadline_at} />
          </span>
          <span className="flex gap-1">
            <Button
              variant="outline"
              size="xs"
              onClick={() =>
                updateConflict({ id: conflict.id, body: { deadline_at: extendDeadline(conflict.deadline_at, 5) } })
              }
            >
              +5 min
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => updateConflict({ id: conflict.id, body: { deadline_at: null } })}
            >
              Clear timer
            </Button>
          </span>
        </div>
      ) : null}

      {!ongoing ? (
        <div className="bg-muted mt-3 rounded-md p-2 text-xs">
          <p className="font-semibold">
            Resolved {conflict.resolved_at ? format(new Date(conflict.resolved_at), "MMM d, h:mm a") : ""} ·{" "}
            {winner ? `${winner.name} prevailed` : "No clear winner"}
          </p>
          {conflict.outcome_summary ? <p className="mt-0.5">{conflict.outcome_summary}</p> : null}
        </div>
      ) : null}

      <div className="mt-4 flex justify-between gap-2">
        <Button
          variant="outline"
          className={cn(outlineButton, "flex-1 px-0")}
          disabled={!ongoing}
          onClick={() => actions.openResolveConflict(conflict)}
        >
          Resolve
        </Button>
        <Button
          variant="outline"
          className={cn(outlineButton, "flex-1 px-0")}
          disabled={!placed.length}
          onClick={() => actions.focusMap(centroid(placed.map((c) => ({ x: c.x!, y: c.y! }))))}
        >
          View
        </Button>
        <Button
          className={cn(solidButton, "flex-1 px-0")}
          onClick={() =>
            actions.openAddNote({
              conflictId: conflict.id,
              authorIds: conflict.parties.slice(0, 1).map((p) => p.id),
              targetIds: conflict.parties.slice(1).map((p) => p.id),
              action: "CONFLICT",
            })
          }
        >
          Create
        </Button>
        <Button className={cn(dangerButton, "flex-1 px-0")} onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
      </div>

      <section className="mt-6">
        <div className="flex items-center justify-between gap-2 border-b pb-2">
          <h3 className="text-lg leading-7 font-semibold tracking-tight">Crisis Notes</h3>
          <div className="flex gap-1">
            <NoteFilterButton value={filter} onChange={setFilter} />
            <Button
              className={cn(solidButton, "w-[70px]")}
              onClick={() =>
                actions.openAddNote({
                  conflictId: conflict.id,
                  authorIds: conflict.parties.slice(0, 1).map((p) => p.id),
                  targetIds: conflict.parties.slice(1).map((p) => p.id),
                  action: "CONFLICT",
                })
              }
            >
              Create
            </Button>
          </div>
        </div>
        <div className="mt-3">
          <NoteList notes={filtered} loading={isLoading} empty="No updates logged for this conflict yet." />
        </div>
      </section>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{conflict.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The conflict is removed for every party. Notes already logged about it are kept. Use
              Resolve instead if it ended in the story.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() =>
                deleteConflict(conflict.id, {
                  onSuccess: () => {
                    setConfirmDelete(false);
                    navigate({ tab: "conflict" });
                  },
                })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
