"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Feedback";
import { REPORT_REASONS, REPORT_REASON_LABELS } from "@/lib/domain";
import { submitReport } from "@/server/safety";

export function ReportButton({
  targetUserId,
  targetOutingId,
  label = "Report",
}: {
  targetUserId?: string;
  targetOutingId?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]>(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <Button variant="ghost" size="sm" className="text-danger" onClick={() => setOpen(true)}>
        🚩 {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Report">
        {done ? (
          <Notice tone="success">Thanks — our team will review this.</Notice>
        ) : (
          <div className="space-y-3">
            {error && <Notice tone="danger">{error}</Notice>}
            <Select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {REPORT_REASON_LABELS[r]}
                </option>
              ))}
            </Select>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Anything else that would help us understand (optional)"
              maxLength={1500}
            />
            <Button
              className="w-full"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await submitReport({ reason, details, targetUserId, targetOutingId });
                  if (!result.ok) setError(result.error);
                  else setDone(true);
                })
              }
            >
              {pending ? "Submitting…" : "Submit report"}
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
