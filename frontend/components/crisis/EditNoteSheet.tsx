"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea";
import { useCharacters } from "@/hooks/useCharacters";
import { useUpdateNote } from "@/hooks/useCrisisNotes";
import type { CrisisNoteResponse, NoteType, Priority } from "@/types/api";

interface Props {
  note: CrisisNoteResponse | null;
  onOpenChange: (open: boolean) => void;
}

export function EditNoteSheet({ note, onOpenChange }: Props) {
  const { data: characters } = useCharacters();
  const { mutate, isPending } = useUpdateNote();

  const [form, setForm] = useState({
    character_id: "",
    title: "",
    description: "",
    crisis_staff_notes: "",
    priority: "" as Priority | "",
    note_type: "" as NoteType | "",
  });

  useEffect(() => {
    if (note) {
      setForm({
        character_id: String(note.character.id),
        title: note.title,
        description: note.description,
        crisis_staff_notes: note.crisis_staff_notes ?? "",
        priority: note.priority,
        note_type: note.note_type,
      });
    }
  }, [note]);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note) return;
    mutate(
      {
        id: note.id,
        body: {
          character_id: Number(form.character_id),
          title: form.title,
          description: form.description,
          crisis_staff_notes: form.crisis_staff_notes || null,
          priority: form.priority as Priority,
          note_type: form.note_type as NoteType,
        },
      },
      { onSuccess: () => onOpenChange(false) }
    );
  }

  return (
    <Dialog open={!!note} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Crisis Note</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Character</Label>
              <Select value={form.character_id} onValueChange={(v) => set("character_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select character…" />
                </SelectTrigger>
                <SelectContent>
                  {characters?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Priority…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.note_type} onValueChange={(v) => set("note_type", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Directive type…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRIVATE_DIRECTIVE">Private Directive</SelectItem>
                <SelectItem value="PUBLIC_DIRECTIVE">Public Directive</SelectItem>
                <SelectItem value="CRISIS_UPDATE">Crisis Update</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Crisis Staff Notes{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              rows={3}
              value={form.crisis_staff_notes}
              onChange={(e) => set("crisis_staff_notes", e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
