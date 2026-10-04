"use client";

import { useEffect, useState } from "react";
import { ExternalLinkIcon, MonitorIcon, PlusIcon } from "lucide-react";

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
import {
  useCreateGroup,
  useDeleteGroup,
  useGroups,
  useMapCharacters,
  useMoveToGroup,
  useUpdateGroup,
} from "@/hooks/useMap";
import { cn } from "@/lib/utils";
import type { GroupResponse, MapCharacter } from "@/types/api";
import { CharacterMultiSelect } from "./CharacterMultiSelect";
import { CharacterAvatar, SectionHeading, Tag } from "./parts";
import { useMapParams } from "./useMapParams";

// Distinct on the parchment map and from each other.
export const GROUP_COLORS = ["#d08700", "#7a3b3b", "#2f6f4f", "#3f5f9a", "#7b4f9d", "#b5582a", "#2b7a8a", "#5a5a5a"];

export function screenUrl(groupId?: number) {
  return groupId != null ? `/map/screen?group=${groupId}` : "/map/screen";
}

/**
 * Travelling groups. Everyone starts together; when the committee splits,
 * staff create groups and each one gets its own delegate screen showing only
 * what that group knows.
 */
export function GroupsTab() {
  const { data: groups = [] } = useGroups();
  const { data: characters = [] } = useMapCharacters();
  const [creating, setCreating] = useState(false);
  const ungrouped = characters.filter((c) => c.group_id == null);

  return (
    <div className="space-y-5">
      <SectionHeading title="Groups">
        <Button size="sm" onClick={() => setCreating(true)}>
          <PlusIcon />
          Split off a group
        </Button>
      </SectionHeading>
      <p className="text-muted-foreground -mt-3 text-xs">
        Each group&apos;s screen shows its own members live, and everyone else where the group last saw them.
      </p>

      <ul className="space-y-3">
        {groups.map((g, i) => (
          <li key={g.id}>
            <GroupCard group={g} characters={characters} isStarting={i === 0} />
          </li>
        ))}
      </ul>

      {ungrouped.length ? (
        <p className="text-muted-foreground text-xs">
          Not in any group: {ungrouped.map((c) => c.name).join(", ")}
        </p>
      ) : null}

      <Button variant="outline" className="w-full" asChild>
        <a href={screenUrl()} target="_blank" rel="noreferrer">
          <MonitorIcon />
          Open whole-committee delegate screen
          <ExternalLinkIcon className="ml-auto" />
        </a>
      </Button>

      <CreateGroupDialog open={creating} onOpenChange={setCreating} usedColors={groups.map((g) => g.color)} />
    </div>
  );
}

function GroupCard({
  group,
  characters,
  isStarting,
}: {
  group: GroupResponse;
  characters: MapCharacter[];
  isStarting: boolean;
}) {
  const { navigate } = useMapParams();
  const { mutate: moveToGroup } = useMoveToGroup();
  const { mutate: updateGroup } = useUpdateGroup();
  const { mutate: deleteGroup, isPending } = useDeleteGroup();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(group.name);
  useEffect(() => setName(group.name), [group.name]);

  const members = characters.filter((c) => c.group_id === group.id);
  const others = characters.filter((c) => c.group_id !== group.id);
  const ringHere = members.some((c) => c.has_ring);

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ boxShadow: `inset 4px 0 0 ${group.color}` }}>
        <ColorDot color={group.color} onChange={(color) => updateGroup({ id: group.id, body: { color } })} />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== group.name && updateGroup({ id: group.id, body: { name: name.trim() } })}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          aria-label="Group name"
          className="h-7 min-w-0 flex-1 border-transparent px-1.5 text-sm font-semibold shadow-none hover:border-input md:text-sm"
        />
        {ringHere ? <Tag tone="orange">Ring-bearers</Tag> : null}
        <span className="text-muted-foreground text-xs">{members.length}</span>
      </div>

      <div className="border-t px-3 py-2.5">
        {members.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {members.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => navigate({ tab: "character", character: c.id })}
                  className="hover:bg-muted flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-xs"
                >
                  <CharacterAvatar character={c} className="size-5 ring-0" />
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-xs">Nobody travelling in this group.</p>
        )}
      </div>

      <div className="bg-muted/40 flex items-center gap-1.5 border-t px-3 py-2">
        <Select value="" onValueChange={(v) => moveToGroup({ groupId: group.id, characterIds: [Number(v)] })}>
          <SelectTrigger size="sm" className="bg-background h-7 flex-1 text-xs" disabled={!others.length}>
            <SelectValue placeholder="Add someone…" />
          </SelectTrigger>
          <SelectContent>
            {others.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="bg-background h-7" asChild>
          <a href={screenUrl(group.id)} target="_blank" rel="noreferrer">
            <MonitorIcon />
            Screen
          </a>
        </Button>
        {!isStarting ? (
          <Button variant="ghost" size="sm" className="text-destructive h-7" onClick={() => setConfirmDelete(true)}>
            Disband
          </Button>
        ) : null}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disband {group.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its members rejoin the starting group. Their travel history is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={() => deleteGroup(group.id)}>
              Disband
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ColorDot({ color, onChange }: { color: string; onChange: (color: string) => void }) {
  return (
    <Select value={color} onValueChange={onChange}>
      <SelectTrigger
        aria-label="Group colour"
        className="size-5 shrink-0 rounded-full border-2 border-white p-0 shadow-sm ring-1 ring-black/10 data-[size=default]:h-5 [&>svg]:hidden"
        style={{ backgroundColor: color }}
      >
        <span className="sr-only">
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {GROUP_COLORS.map((c) => (
          <SelectItem key={c} value={c}>
            <span className="size-3 rounded-full" style={{ backgroundColor: c }} />
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CreateGroupDialog({
  open,
  onOpenChange,
  usedColors,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usedColors: string[];
}) {
  const { data: characters = [] } = useMapCharacters();
  const { mutate, isPending } = useCreateGroup();
  const [name, setName] = useState("");
  const [color, setColor] = useState(GROUP_COLORS[1]);
  const [memberIds, setMemberIds] = useState<number[]>([]);

  useEffect(() => {
    if (!open) return;
    setName("");
    setMemberIds([]);
    setColor(GROUP_COLORS.find((c) => !usedColors.includes(c)) ?? GROUP_COLORS[1]);
  }, [open, usedColors]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[20px] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Split off a group</DialogTitle>
          <DialogDescription>
            Members leave their current group now. From here on, each group only sees where the others were when
            they parted.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            mutate({ name: name.trim(), color, member_ids: memberIds }, { onSuccess: () => onOpenChange(false) });
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="group-name" className="text-xs">
              Name
            </Label>
            <Input
              id="group-name"
              placeholder="The Ring-bearers"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Colour</Label>
            <div className="flex gap-2">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "size-7 rounded-full ring-offset-2 transition",
                    color === c ? "ring-foreground ring-2" : "hover:scale-110"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="group-members" className="text-xs">
              Who goes with them?
            </Label>
            <CharacterMultiSelect id="group-members" characters={characters} value={memberIds} onChange={setMemberIds} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Back
            </Button>
            <Button type="submit" disabled={!name.trim() || isPending}>
              Create group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
