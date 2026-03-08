"use client";

import { useState, useCallback } from "react";
import { InvoiceActions } from "./InvoiceActions";
import { VALID_INVOICE_TRANSITIONS } from "@/lib/constants";

interface Props {
  invoiceId: string;
  initialStatus: string;
  initialAllowedTransitions: string[];
  fortnoxId: string | null;
  fortnoxSyncStatus: string;
  fortnoxErrorMsg: string | null;
}

export function InvoiceDetail({
  invoiceId,
  initialStatus,
  initialAllowedTransitions,
  fortnoxId,
  fortnoxSyncStatus,
  fortnoxErrorMsg,
}: Props) {
  const [currentStatus, setCurrentStatus] = useState(initialStatus);

  const allowedTransitions = currentStatus === initialStatus
    ? initialAllowedTransitions
    : VALID_INVOICE_TRANSITIONS[currentStatus] ?? [];

  const handleOptimisticUpdate = useCallback((newStatus: string) => {
    setCurrentStatus(newStatus);
  }, []);

  const handleRollback = useCallback(() => {
    setCurrentStatus(initialStatus);
  }, [initialStatus]);

  return (
    <InvoiceActions
      invoiceId={invoiceId}
      currentStatus={currentStatus}
      allowedTransitions={allowedTransitions}
      fortnoxId={fortnoxId}
      fortnoxSyncStatus={fortnoxSyncStatus}
      fortnoxErrorMsg={fortnoxErrorMsg}
      onOptimisticUpdate={handleOptimisticUpdate}
      onRollback={handleRollback}
    />
  );
}
