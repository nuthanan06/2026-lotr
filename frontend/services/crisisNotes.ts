import { apiClient } from "@/lib/apiClient";
import type {
  AnalyticsSummary,
  CrisisNoteCreate,
  CrisisNoteResponse,
  CrisisNoteUpdate,
  NoteFilters,
} from "@/types/api";

export const crisisNotesService = {
  list: (filters: NoteFilters) => {
    const params = new URLSearchParams();
    if (filters.period_id != null) params.set("period_id", String(filters.period_id));
    if (filters.archived_only) params.set("archived_only", "true");
    if (filters.character_id != null) params.set("character_id", String(filters.character_id));
    if (filters.priority) params.set("priority", filters.priority);
    if (filters.note_type) params.set("note_type", filters.note_type);
    if (filters.conflict_id != null) params.set("conflict_id", String(filters.conflict_id));
    if (filters.q) params.set("q", filters.q);
    return apiClient.get<CrisisNoteResponse[]>(`/api/notes?${params}`);
  },

  create: (body: CrisisNoteCreate) => apiClient.post<CrisisNoteResponse>("/api/notes", body),

  update: (id: number, body: CrisisNoteUpdate) =>
    apiClient.patch<CrisisNoteResponse>(`/api/notes/${id}`, body),

  delete: (id: number) => apiClient.delete<void>(`/api/notes/${id}`),

  getAnalytics: (periodId: number | null) => {
    const params = periodId != null ? `?period_id=${periodId}` : "";
    return apiClient.get<AnalyticsSummary>(`/api/notes/analytics${params}`);
  },
};
