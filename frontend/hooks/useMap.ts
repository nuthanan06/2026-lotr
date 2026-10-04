"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { charactersService } from "@/services/characters";
import { conflictsService, gameService, groupsService, regionsService } from "@/services/map";
import type {
  CharacterUpdate,
  ConflictCreate,
  ConflictUpdate,
  GroupCreate,
  ConflictResolve,
  MoveRequest,
  RegionUpdate,
} from "@/types/api";

// Several crisis staff work the map at once; poll so everyone's view
// converges within a few seconds without a websocket layer.
const LIVE = { refetchInterval: 5000 } as const;

export function useMapCharacters() {
  return useQuery({
    queryKey: ["characters"],
    queryFn: () => charactersService.list(),
    ...LIVE,
  });
}

export function useGameState() {
  return useQuery({ queryKey: ["game"], queryFn: () => gameService.get(), ...LIVE });
}

export function useRegions() {
  return useQuery({ queryKey: ["regions"], queryFn: () => regionsService.list(), ...LIVE });
}

export function useConflicts() {
  return useQuery({ queryKey: ["conflicts"], queryFn: () => conflictsService.list(), ...LIVE });
}

export function useMovements(characterId: number | null) {
  return useQuery({
    queryKey: ["movements", characterId],
    queryFn: () => charactersService.movements(characterId!),
    enabled: characterId != null,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export function useUpdateCharacter() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: CharacterUpdate }) =>
      charactersService.update(id, body),
    onSuccess: () => invalidate("characters"),
    onError: (err: Error) => toast.error(err.message || "Failed to update character."),
  });
}

export function useMoveCharacter() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: MoveRequest }) =>
      charactersService.move(id, body),
    onSuccess: (character) => {
      invalidate("characters", "regions", "notes", "movements", "groups");
      toast.success(`${character.name} moved.`);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to move character."),
  });
}

export function useSetRingHolder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (characterId: number | null) => gameService.setRingHolder(characterId),
    onSuccess: () => invalidate("game", "characters"),
    onError: (err: Error) => toast.error(err.message || "Failed to change the Ring holder."),
  });
}

export function useSetClockPaused() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (paused: boolean) => gameService.setClockPaused(paused),
    onSuccess: () => invalidate("game", "characters"),
    onError: (err: Error) => toast.error(err.message || "Failed to update the clock."),
  });
}

export function useUpdateRegion() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: RegionUpdate }) =>
      regionsService.update(id, body),
    onSuccess: () => invalidate("regions"),
    onError: (err: Error) => toast.error(err.message || "Failed to update region."),
  });
}

export function useCreateConflict() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: ConflictCreate) => conflictsService.create(body),
    onSuccess: (conflict) => {
      invalidate("conflicts", "characters", "notes");
      toast.success(`“${conflict.name}” has begun.`);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create conflict."),
  });
}

export function useResolveConflict() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ConflictResolve }) =>
      conflictsService.resolve(id, body),
    onSuccess: (conflict) => {
      invalidate("conflicts", "characters", "notes");
      toast.success(`“${conflict.name}” resolved.`);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to resolve conflict."),
  });
}

export function useDeleteConflict() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => conflictsService.delete(id),
    onSuccess: () => {
      invalidate("conflicts", "characters", "notes");
      toast.success("Conflict deleted.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete conflict."),
  });
}

export function useUpdateConflict() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ConflictUpdate }) => conflictsService.update(id, body),
    onSuccess: () => invalidate("conflicts"),
    onError: (err: Error) => toast.error(err.message || "Failed to update conflict."),
  });
}

export function useRevealDiscovered() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => regionsService.revealDiscovered(),
    onSuccess: ({ revealed }) => {
      invalidate("regions");
      toast.success(
        revealed.length ? `Revealed ${revealed.length} region${revealed.length === 1 ? "" : "s"} to delegates.` : "Nothing new to reveal."
      );
    },
    onError: (err: Error) => toast.error(err.message || "Failed to reveal regions."),
  });
}

export function useGroups() {
  return useQuery({ queryKey: ["groups"], queryFn: () => groupsService.list(), ...LIVE });
}

export function useGroupView(groupId: number | null) {
  return useQuery({
    queryKey: ["groups", groupId, "view"],
    queryFn: () => groupsService.view(groupId!),
    enabled: groupId != null,
    ...LIVE,
  });
}

export function useCreateGroup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: GroupCreate) => groupsService.create(body),
    onSuccess: (group) => {
      invalidate("groups", "characters");
      toast.success(`${group.name} has set out.`);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create group."),
  });
}

export function useUpdateGroup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: { name?: string; color?: string } }) =>
      groupsService.update(id, body),
    onSuccess: () => invalidate("groups"),
    onError: (err: Error) => toast.error(err.message || "Failed to update group."),
  });
}

export function useMoveToGroup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ groupId, characterIds }: { groupId: number; characterIds: number[] }) =>
      groupsService.addMembers(groupId, characterIds),
    onSuccess: () => invalidate("groups", "characters"),
    onError: (err: Error) => toast.error(err.message || "Failed to move character."),
  });
}

export function useDeleteGroup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => groupsService.delete(id),
    onSuccess: () => {
      invalidate("groups", "characters");
      toast.success("Group disbanded; its members rejoined the starting group.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete group."),
  });
}
