import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ServiceResult } from "@/services/auth-service";

export interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  /** Quando definido, exibe um campo obrigatório de justificativa/nota. */
  reasonLabel?: string;
  reasonPlaceholder?: string;
  extraFields?: ReactNode;
  onConfirm: (reason: string) => Promise<ServiceResult>;
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  reasonLabel,
  reasonPlaceholder,
  extraFields,
  onConfirm,
}: ConfirmActionDialogProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<ServiceResult | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setFeedback(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    setSubmitting(true);
    const result = await onConfirm(reason);
    setFeedback(result);
    setSubmitting(false);
    if (result.status === "ok") onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {extraFields}

        {reasonLabel ? (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-reason">{reasonLabel}</Label>
            <Textarea
              id="confirm-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={reasonPlaceholder}
              rows={4}
              required
            />
          </div>
        ) : null}

        {feedback && feedback.status !== "ok" ? (
          <p
            role="alert"
            className={
              feedback.status === "pending"
                ? "rounded-md border border-warning/35 bg-warning/10 px-3 py-2 text-xs text-warning"
                : "rounded-md border border-critical/35 bg-critical/10 px-3 py-2 text-xs text-critical"
            }
          >
            {feedback.message}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={submitting || (Boolean(reasonLabel) && !reason.trim())}
            onClick={() => void handleConfirm()}
          >
            {submitting ? "Processando…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
