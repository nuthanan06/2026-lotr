import { apiClient } from "@/lib/apiClient";
import type {
  ConflictCreate,
  ConflictResolve,
  ConflictResponse,
  ConflictStatus,
  ConflictUpdate,
  GameState,
  GroupCreate,
  GroupResponse,
  GroupView,
  RegionResponse,
  RegionUpdate,
} from "@/types/api";

export const gameService = {
  get: () => apiClient.get<GameState>("/api/game"),
  setClockPaused: (clock_paused: boolean) => apiClient.patch<GameState>("/api/game", { clock_paused }),
  setRingHolder: (character_id: number | null) =>
    apiClient.put<GameState>("/api/game/ring", { character_id }),
};

export const regionsService = {
  list: () => apiClient.get<RegionResponse[]>("/api/regions"),
  update: (id: number, body: RegionUpdate) =>
    apiClient.patch<RegionResponse>(`/api/regions/${id}`, body),
  revealDiscovered: () => apiClient.post<{ revealed: number[] }>("/api/regions/reveal", {}),
};

export const groupsService = {
  list: () => apiClient.get<GroupResponse[]>("/api/groups"),
  create: (body: GroupCreate) => apiClient.post<GroupResponse>("/api/groups", body),
  update: (id: number, body: { name?: string; color?: string }) =>
    apiClient.patch<GroupResponse>(`/api/groups/${id}`, body),
  addMembers: (id: number, character_ids: number[]) =>
    apiClient.post<GroupResponse>(`/api/groups/${id}/members`, { character_ids }),
  delete: (id: number) => apiClient.delete<void>(`/api/groups/${id}`),
  view: (id: number) => apiClient.get<GroupView>(`/api/groups/${id}/view`),
};

export const conflictsService = {
  list: (status?: ConflictStatus) =>
    apiClient.get<ConflictResponse[]>(`/api/conflicts${status ? `?status=${status}` : ""}`),
  create: (body: ConflictCreate) => apiClient.post<ConflictResponse>("/api/conflicts", body),
  update: (id: number, body: ConflictUpdate) =>
    apiClient.patch<ConflictResponse>(`/api/conflicts/${id}`, body),
  resolve: (id: number, body: ConflictResolve) =>
    apiClient.post<ConflictResponse>(`/api/conflicts/${id}/resolve`, body),
  delete: (id: number) => apiClient.delete<void>(`/api/conflicts/${id}`),
};
