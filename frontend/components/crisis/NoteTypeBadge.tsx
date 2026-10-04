import { Badge } from "@/components/ui/badge";
import type { NoteType } from "@/types/api";

const config: Record<NoteType, { label: string; variant: "default" | "secondary" | "outline" }> = {
  PRIVATE_DIRECTIVE: { label: "Private Directive", variant: "default" },
  PUBLIC_DIRECTIVE: { label: "Public Directive", variant: "outline" },
  CRISIS_UPDATE: { label: "Crisis Update", variant: "secondary" },
};

export function NoteTypeBadge({ noteType }: { noteType: NoteType }) {
  const { label, variant } = config[noteType];
  return <Badge variant={variant}>{label}</Badge>;
}
