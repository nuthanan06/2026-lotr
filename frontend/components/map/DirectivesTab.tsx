"use client";

import { useState } from "react";

import { ArchivePeriodDialog } from "@/components/crisis/ArchivePeriodDialog";
import { CreatePeriodDialog } from "@/components/crisis/CreatePeriodDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNotes } from "@/hooks/useCrisisNotes";
import { useActivePeriod } from "@/hooks/useCrisisPeriods";
import { cn } from "@/lib/utils";
import { useMapActions } from "./MapActions";
import { NoteFilterButton, NoteList, useNoteFilter } from "./NoteList";
import { SectionHeading, SidebarSearch, dangerButton, solidButton } from "./parts";

/** Tab 4: the current crisis update's directives, and everything archived. */
export function DirectivesTab() {
  const { data: period } = useActivePeriod();
  const { openAddNote } = useMapActions();
  const { data: current = [], isLoading } = useNotes({ period_id: period?.id }, !!period);
  const { data: archived = [], isLoading: archivedLoading } = useNotes({ archived_only: true });
  const [query, setQuery] = useState("");
  const [archivedQuery, setArchivedQuery] = useState("");
  const { filter, setFilter, filtered } = useNoteFilter(current, query);
  const archivedFiltered = useNoteFilter(archived, archivedQuery).filtered;
  const [finishOpen, setFinishOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);

  return (
    <div className="space-y-6">
      <section>
        <SectionHeading title="Current Crisis Update" />
        {period ? (
          <>
            <p className="text-muted-foreground mt-1 text-[11px]">{period.name}</p>
            <div className="mt-2 flex items-center gap-1.5">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                aria-label="Search current directives"
                className="h-[22px] min-w-0 flex-1 rounded-lg px-2.5 text-xs md:text-xs"
              />
              <NoteFilterButton value={filter} onChange={setFilter} />
              <Button className={cn(solidButton, "w-[70px]")} onClick={() => openAddNote()}>
                Create
              </Button>
              <Button className={cn(dangerButton, "w-[70px]")} onClick={() => setFinishOpen(true)}>
                Finish
              </Button>
            </div>
            <div className="mt-3">
              <NoteList
                notes={filtered}
                pageSize={4}
                loading={isLoading}
                empty="No directives in this crisis update yet."
              />
            </div>
            <ArchivePeriodDialog
              periodId={period.id}
              periodName={period.name}
              open={finishOpen}
              onOpenChange={setFinishOpen}
            />
          </>
        ) : (
          <div className="mt-4 space-y-2 text-sm">
            <p className="text-muted-foreground">No crisis update is running.</p>
            <Button className={solidButton} onClick={() => setStartOpen(true)}>
              Start crisis update
            </Button>
            <CreatePeriodDialog open={startOpen} onOpenChange={setStartOpen} />
          </div>
        )}
      </section>

      <section>
        <SectionHeading title="Archived Directives" />
        <SidebarSearch value={archivedQuery} onChange={setArchivedQuery} className="mt-5" />
        <div className="mt-3">
          <NoteList
            notes={archivedFiltered}
            loading={archivedLoading}
            empty="Nothing archived yet. Finishing a crisis update moves its directives here."
          />
        </div>
      </section>
    </div>
  );
}
