"use client";

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
import { useArchivePeriod } from "@/hooks/useCrisisPeriods";

interface Props {
  periodId: number;
  periodName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArchivePeriodDialog({ periodId, periodName, open, onOpenChange }: Props) {
  const { mutate, isPending } = useArchivePeriod();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive "{periodName}"?</AlertDialogTitle>
          <AlertDialogDescription>
            All current notes will be moved to the archive and any newly discovered regions are
            revealed to delegates. The next round will start automatically so crisis staff can keep
            logging without interruption.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={() => mutate(periodId, { onSuccess: () => onOpenChange(false) })}
          >
            {isPending ? "Archiving…" : "Archive & Start Next Round"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
