export interface HealthResponse {
  status: string;
}

export type Priority = "HIGH" | "MEDIUM" | "LOW";
export type NoteType = "PRIVATE_DIRECTIVE" | "PUBLIC_DIRECTIVE" | "CRISIS_UPDATE";
export type NoteAction = "NONE" | "MOVE" | "MOBILIZE" | "CONFLICT" | "RING";

// ── Characters ───────────────────────────────────────────────────────────────

export interface CharacterResponse {
  id: number;
  name: string;
  created_at: string;
  race: string;
  avatar_url: string | null;
}

export interface MapCharacter extends CharacterResponse {
  // Position as 0–1 fractions of the map image, from the top-left. Null
  // until the character is first placed on the map.
  x: number | null;
  y: number | null;
  region_id: number | null;
  army_mobilized: boolean;
  has_ring: boolean;
  group_id: number | null;
  // Corruption (0–100) as of `as_of`, on the curve a × hours_held². While
  // `accruing`, extrapolate with ring_hours + elapsed hours.
  corruption: number;
  corruption_a: number;
  corruption_a_is_custom: boolean;
  ring_hours: number;
  accruing: boolean;
  corruption_rate_per_hour: number;
  as_of: string;
  ongoing_conflict_ids: number[];
}

export interface CharacterUpdate {
  name?: string;
  race?: string;
  avatar_url?: string | null;
  army_mobilized?: boolean;
  corruption?: number;
  /** null resets to the race default. */
  corruption_a?: number | null;
}

export interface InlineNote {
  title: string;
  description: string;
  priority?: Priority;
  note_type?: NoteType;
}

export interface MoveRequest {
  x: number;
  y: number;
  note_id?: number;
  note?: InlineNote;
  discover_region?: boolean;
}

export interface MovementResponse {
  id: number;
  character_id: number;
  from_x: number | null;
  from_y: number | null;
  to_x: number;
  to_y: number;
  from_region_name: string | null;
  to_region_name: string | null;
  note_id: number | null;
  note_title: string | null;
  created_at: string;
}

// ── Game state / regions / conflicts ─────────────────────────────────────────

export interface GameState {
  ring_holder_id: number | null;
  clock_paused: boolean;
  race_curve_a: Record<string, number>;
  /** Secret link token for the whole-committee delegate screen. */
  screen_token: string;
}

export interface RegionResponse {
  id: number;
  slug: string;
  name: string;
  polygon: [number, number][];
  /** Known to at least one group. */
  discovered: boolean;
  /** Shown to every group that has members (safe for a whole-committee screen). */
  revealed: boolean;
  /** Per-group discovery; a group not listed hasn't found this region. */
  discoveries: RegionDiscovery[];
  status: string | null;
  notes: string | null;
}

export interface RegionDiscovery {
  group_id: number;
  discovered_at: string;
  revealed: boolean;
}

export interface RegionUpdate {
  discovered?: boolean;
  status?: string | null;
  notes?: string | null;
}

export type ConflictStatus = "ONGOING" | "RESOLVED";

export interface ConflictResponse {
  id: number;
  name: string;
  status: ConflictStatus;
  parties: CharacterResponse[];
  winner_id: number | null;
  outcome_summary: string | null;
  created_at: string;
  resolved_at: string | null;
  deadline_at: string | null;
}

export interface ConflictCreate {
  name: string;
  party_ids: number[];
  note_id?: number;
  timer_minutes?: number;
}

export interface ConflictUpdate {
  name?: string;
  party_ids?: number[];
  deadline_at?: string | null;
}

// ── Groups ───────────────────────────────────────────────────────────────────

export interface GroupResponse {
  id: number;
  name: string;
  color: string;
  created_at: string;
  member_ids: number[];
  /** Secret link token for this group's delegate screen. */
  screen_token: string;
}

export interface GroupCreate {
  name: string;
  color: string;
  member_ids?: number[];
}

export interface LastSeen {
  character_id: number;
  x: number;
  y: number;
  seen_at: string;
}

// ── Delegate screens (public, token-gated, read-only) ───────────────────────

export interface ScreenView {
  title: string;
  color: string | null;
  characters: { id: number; name: string; avatar_url: string | null; x: number; y: number; has_ring: boolean; army_mobilized: boolean }[];
  last_seen: { id: number; name: string; avatar_url: string | null; x: number; y: number; seen_at: string }[];
  regions: { id: number; name: string; polygon: [number, number][]; revealed: boolean }[];
  conflicts: { id: number; name: string; party_ids: number[]; deadline_at: string | null }[];
}

export interface GroupView {
  group: GroupResponse;
  member_ids: number[];
  last_seen: LastSeen[];
  /** Regions this group's delegates have been shown. */
  revealed_region_ids: number[];
}

export interface ConflictResolve {
  winner_id: number | null;
  outcome_summary: string;
}

export interface CharacterCreate {
  name: string;
}

export interface BulkUploadResult {
  created: number;
  skipped: number;
}

// ── Crisis Periods ────────────────────────────────────────────────────────────

export interface CrisisPeriodResponse {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
  archived_at: string | null;
}

export interface CrisisPeriodCreate {
  name: string;
}

// ── Crisis Notes ──────────────────────────────────────────────────────────────

export interface CrisisNoteResponse {
  id: number;
  period_id: number;
  character: CharacterResponse;
  title: string;
  description: string;
  crisis_staff_notes: string | null;
  priority: Priority;
  note_type: NoteType;
  action: NoteAction;
  conflict_id: number | null;
  // Co-authors beyond `character`, and characters the note is aimed at.
  authors: CharacterResponse[];
  targets: CharacterResponse[];
  deadline_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface CrisisNoteCreate {
  character_id: number;
  // The period the client expects the note to land in. The backend rejects
  // the submission (409) if the active period has changed since, instead of
  // silently filing it under a different period than the user saw.
  period_id?: number;
  title: string;
  description: string;
  crisis_staff_notes?: string;
  priority: Priority;
  note_type: NoteType;
  action?: NoteAction;
  conflict_id?: number | null;
  author_ids?: number[];
  target_ids?: number[];
  timer_minutes?: number;
}

export interface CrisisNoteUpdate {
  character_id?: number;
  title?: string;
  description?: string;
  crisis_staff_notes?: string | null;
  priority?: Priority;
  note_type?: NoteType;
  action?: NoteAction;
  conflict_id?: number | null;
  author_ids?: number[];
  target_ids?: number[];
  deadline_at?: string | null;
  resolved?: boolean;
}

export interface NoteFilters {
  period_id?: number;
  archived_only?: boolean;
  character_id?: number;
  priority?: Priority;
  note_type?: NoteType;
  conflict_id?: number;
  q?: string;
}

// ── Staff Notes ───────────────────────────────────────────────────────────────

export interface StaffNoteResponse {
  id: number;
  period_id: number;
  title: string;
  content: string;
  created_at: string;
}

export interface StaffNoteCreate {
  title: string;
  content: string;
}

export interface StaffNoteUpdate {
  title?: string;
  content?: string;
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface NotesByCharacter {
  character_name: string;
  count: number;
}

export interface PriorityCount {
  priority: Priority;
  count: number;
}

export interface AnalyticsSummary {
  total_notes: number;
  notes_by_character: NotesByCharacter[];
  priority_distribution: PriorityCount[];
  private_directive_count: number;
  public_directive_count: number;
}
