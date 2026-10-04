import { apiClient } from "@/lib/apiClient";
import type {
  BulkUploadResult,
  CharacterCreate,
  CharacterResponse,
  CharacterUpdate,
  MapCharacter,
  MovementResponse,
  MoveRequest,
} from "@/types/api";

export const charactersService = {
  list: () => apiClient.get<MapCharacter[]>("/api/characters"),
  create: (body: CharacterCreate) => apiClient.post<CharacterResponse>("/api/characters", body),
  update: (id: number, body: CharacterUpdate) =>
    apiClient.patch<MapCharacter>(`/api/characters/${id}`, body),
  move: (id: number, body: MoveRequest) =>
    apiClient.post<MapCharacter>(`/api/characters/${id}/move`, body),
  movements: (id: number) =>
    apiClient.get<MovementResponse[]>(`/api/characters/${id}/movements`),
  delete: (id: number) => apiClient.delete<void>(`/api/characters/${id}`),

  bulkUpload: async (file: File): Promise<BulkUploadResult> => {
    const form = new FormData();
    form.append("file", file);
    // Same-origin proxy route (see apiClient.ts) — not the backend directly.
    const res = await fetch("/api/backend/api/characters/bulk", {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Upload failed (${res.status}): ${text}`);
    }
    return res.json();
  },
};
