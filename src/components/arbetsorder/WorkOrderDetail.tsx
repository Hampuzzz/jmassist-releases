"use client";

import { useState, useCallback } from "react";
import { WorkOrderActions } from "./WorkOrderActions";
import { VALID_STATUS_TRANSITIONS } from "@/lib/constants";

interface ApprovalInfo {
  id: string;
  status: string;
  token: string;
  expiresAt: string;
}

interface Props {
  orderId: string;
  initialStatus: string;
  initialAllowedTransitions: string[];
  approvalRequests: ApprovalInfo[];
}

export function WorkOrderDetail({
  orderId,
  initialStatus,
  initialAllowedTransitions,
  approvalRequests,
}: Props) {
  const [currentStatus, setCurrentStatus] = useState(initialStatus);

  // Re-derive allowed transitions when status changes optimistically
  const allowedTransitions = currentStatus === initialStatus
    ? initialAllowedTransitions
    : VALID_STATUS_TRANSITIONS[currentStatus] ?? [];

  const handleOptimisticUpdate = useCallback((newStatus: string) => {
    setCurrentStatus(newStatus);
  }, []);

  const handleRollback = useCallback(() => {
    setCurrentStatus(initialStatus);
  }, [initialStatus]);

  return (
    <WorkOrderActions
      orderId={orderId}
      currentStatus={currentStatus}
      allowedTransitions={allowedTransitions}
      approvalRequests={approvalRequests}
      onOptimisticUpdate={handleOptimisticUpdate}
      onRollback={handleRollback}
    />
  );
}
