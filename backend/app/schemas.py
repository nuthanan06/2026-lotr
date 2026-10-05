from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.crisis_note import NoteAction, NoteType, Priority
from app.models.map import ConflictStatus


class HealthResponse(BaseModel):
    status: str = "ok"


# ── Characters ──────────────────────────────────────────────────────────────

class CharacterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class CharacterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_at: datetime
    race: str = "MAN"
    avatar_url: str | None = None


class MapCharacterResponse(CharacterResponse):
    x: float | None
    y: float | None
    region_id: int | None
    army_mobilized: bool
    has_ring: bool
    group_id: int | None
    # Corruption as of `as_of`, on the curve a × hours_held². While
    # `accruing`, the client extrapolates with ring_hours + elapsed time.
    corruption: float
    corruption_a: float
    corruption_a_is_custom: bool
    ring_hours: float
    accruing: bool
    corruption_rate_per_hour: float
    as_of: datetime
    ongoing_conflict_ids: list[int]


class CharacterUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    race: str | None = None
    avatar_url: str | None = Field(default=None, max_length=1024)
    army_mobilized: bool | None = None
    corruption: float | None = Field(default=None, ge=0, le=100)
    # Curve steepness; send null to go back to the race default.
    corruption_a: float | None = Field(default=None, gt=0, le=100)


class InlineNote(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    description: str = Field(min_length=1)
    priority: Priority = Priority.MEDIUM
    note_type: NoteType = NoteType.PRIVATE_DIRECTIVE


class MoveRequest(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    # Every move must cite a crisis note: either an existing one or a new
    # one written in the move dialog.
    note_id: int | None = None
    note: InlineNote | None = None
    discover_region: bool = False


class MovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    character_id: int
    from_x: float | None
    from_y: float | None
    to_x: float
    to_y: float
    from_region_name: str | None
    to_region_name: str | None
    note_id: int | None
    note_title: str | None
    created_at: datetime


# ── Game state / regions ─────────────────────────────────────────────────────

class GameStateResponse(BaseModel):
    ring_holder_id: int | None
    clock_paused: bool
    race_curve_a: dict[str, float]
    # Secret link token for the whole-committee delegate screen.
    screen_token: str


class GameStateUpdate(BaseModel):
    clock_paused: bool | None = None


class RingHolderUpdate(BaseModel):
    character_id: int | None


class RegionDiscovery(BaseModel):
    group_id: int
    discovered_at: datetime
    revealed: bool


class RegionResponse(BaseModel):
    id: int
    slug: str
    name: str
    polygon: list[list[float]]
    # Known to any group / revealed to every group that has members.
    discovered: bool
    revealed: bool
    # Per-group discovery; a group not listed hasn't found this region.
    discoveries: list[RegionDiscovery]
    status: str | None
    notes: str | None


class RegionDiscoveryUpdate(BaseModel):
    group_id: int
    discovered: bool


class RevealResult(BaseModel):
    revealed: list[int]


class RegionUpdate(BaseModel):
    # Sets discovery for every group at once; use /discovery for one group.
    discovered: bool | None = None
    status: str | None = Field(default=None, max_length=255)
    notes: str | None = None


# ── Groups ───────────────────────────────────────────────────────────────────

class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    member_ids: list[int] = []


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")


class GroupMembersUpdate(BaseModel):
    """Move these characters into the group (out of whatever group they were in)."""

    character_ids: list[int] = Field(min_length=1)


class GroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: str
    created_at: datetime
    member_ids: list[int]
    # Secret link token for this group's delegate screen.
    screen_token: str


class LastSeen(BaseModel):
    character_id: int
    x: float
    y: float
    seen_at: datetime


class GroupViewResponse(BaseModel):
    """What one group's delegates know: their own members live, everyone else
    where they were last seen together."""

    group: GroupResponse
    member_ids: list[int]
    last_seen: list[LastSeen]
    # Regions this group's delegates have been shown.
    revealed_region_ids: list[int]


# ── Delegate screens ─────────────────────────────────────────────────────────
# What a public, token-gated delegate screen receives. Deliberately minimal:
# no notes, corruption, groups or positions the audience shouldn't know.

class ScreenCharacter(BaseModel):
    id: int
    name: str
    avatar_url: str | None
    x: float
    y: float
    has_ring: bool
    army_mobilized: bool


class ScreenLastSeen(BaseModel):
    id: int
    name: str
    avatar_url: str | None
    x: float
    y: float
    seen_at: datetime


class ScreenRegion(BaseModel):
    id: int
    name: str
    polygon: list[list[float]]
    revealed: bool


class ScreenConflict(BaseModel):
    id: int
    name: str
    party_ids: list[int]
    deadline_at: datetime | None


class ScreenView(BaseModel):
    title: str
    color: str | None
    characters: list[ScreenCharacter]
    last_seen: list[ScreenLastSeen]
    regions: list[ScreenRegion]
    conflicts: list[ScreenConflict]


# ── Conflicts ────────────────────────────────────────────────────────────────

class ConflictCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    party_ids: list[int] = Field(min_length=2)
    note_id: int | None = None
    # Timed crisis: minutes until staff are alerted if it's unresolved.
    timer_minutes: int | None = Field(default=None, ge=1, le=24 * 60)


class ConflictUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    party_ids: list[int] | None = Field(default=None, min_length=2)
    deadline_at: datetime | None = None


class ConflictResolve(BaseModel):
    winner_id: int | None = None
    outcome_summary: str = Field(min_length=1)


class ConflictResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    status: ConflictStatus
    parties: list[CharacterResponse]
    winner_id: int | None
    outcome_summary: str | None
    created_at: datetime
    resolved_at: datetime | None
    deadline_at: datetime | None


# ── Crisis Periods ───────────────────────────────────────────────────────────

class CrisisPeriodCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class CrisisPeriodResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    is_active: bool
    created_at: datetime
    archived_at: datetime | None


# ── Crisis Notes ─────────────────────────────────────────────────────────────

class CrisisNoteCreate(BaseModel):
    character_id: int
    # Optional: lets the client assert which period it expects the note to
    # land in, so create_note can reject a stale submission (see there) if
    # the active period has since changed. Omit to just use whatever period
    # is currently active.
    period_id: int | None = None
    title: str = Field(min_length=1, max_length=512)
    description: str = Field(min_length=1)
    crisis_staff_notes: str | None = None
    priority: Priority
    note_type: NoteType
    action: NoteAction = NoteAction.NONE
    conflict_id: int | None = None
    # Co-authors beyond character_id, and characters the note is aimed at.
    author_ids: list[int] = []
    target_ids: list[int] = []
    # Timed crisis: minutes until staff are alerted if it's unresolved.
    timer_minutes: int | None = Field(default=None, ge=1, le=24 * 60)


class CrisisNoteUpdate(BaseModel):
    character_id: int | None = None
    title: str | None = Field(default=None, min_length=1, max_length=512)
    description: str | None = Field(default=None, min_length=1)
    crisis_staff_notes: str | None = None
    priority: Priority | None = None
    note_type: NoteType | None = None
    action: NoteAction | None = None
    conflict_id: int | None = None
    author_ids: list[int] | None = None
    target_ids: list[int] | None = None
    deadline_at: datetime | None = None
    resolved: bool | None = None


class CrisisNoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    period_id: int
    character: CharacterResponse
    title: str
    description: str
    crisis_staff_notes: str | None
    priority: Priority
    note_type: NoteType
    action: NoteAction
    conflict_id: int | None
    authors: list[CharacterResponse]
    targets: list[CharacterResponse]
    deadline_at: datetime | None
    resolved_at: datetime | None
    created_at: datetime


# ── Staff Notes ───────────────────────────────────────────────────────────────

class StaffNoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    content: str = Field(min_length=1)


class StaffNoteUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=512)
    content: str | None = Field(default=None, min_length=1)


class StaffNoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    period_id: int
    title: str
    content: str
    created_at: datetime


# ── Bulk upload ──────────────────────────────────────────────────────────────

class BulkUploadResult(BaseModel):
    created: int
    skipped: int


# ── Analytics ────────────────────────────────────────────────────────────────

class NotesByCharacter(BaseModel):
    character_name: str
    count: int


class PriorityCount(BaseModel):
    priority: Priority
    count: int


class AnalyticsSummary(BaseModel):
    total_notes: int
    notes_by_character: list[NotesByCharacter]
    priority_distribution: list[PriorityCount]
    private_directive_count: int
    public_directive_count: int
