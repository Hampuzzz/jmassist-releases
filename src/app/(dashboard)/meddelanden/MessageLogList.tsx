"use client";

import { useState } from "react";
import {
  MessageSquare, Mail, CheckCircle, XCircle, AlertTriangle,
  Phone, Clock, Filter,
} from "lucide-react";

type MessageRow = {
  id: string;
  channel: string;
  type: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  recipientName: string | null;
  message: string;
  status: string;
  externalId: string | null;
  costSek: number | null;
  errorMessage: string | null;
  relatedEntityType: string | null;
  sentAt: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerCompany: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  status_update: "Statusuppdatering",
  approval_request: "Godkännande",
  crm_reminder: "CRM-påminnelse",
  vhc_report: "Hälsokontroll",
  review_request: "Recensionsförfrågan",
  manual: "Manuellt",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  sent: { label: "Skickat", color: "text-green-400", icon: CheckCircle },
  delivered: { label: "Levererat", color: "text-green-500", icon: CheckCircle },
  failed: { label: "Misslyckat", color: "text-red-400", icon: XCircle },
  mock: { label: "Mock (ej skickat)", color: "text-yellow-400", icon: AlertTriangle },
};

type Props = {
  initialMessages: MessageRow[];
};

export function MessageLogList({ initialMessages }: Props) {
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = filter === "all"
    ? initialMessages
    : initialMessages.filter((m) => m.status === filter);

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-workshop-muted" />
        {[
          { value: "all", label: "Alla" },
          { value: "sent", label: "Skickade" },
          { value: "failed", label: "Misslyckade" },
          { value: "mock", label: "Mock" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              filter === f.value
                ? "bg-workshop-accent text-white border-workshop-accent"
                : "border-workshop-border text-workshop-muted hover:text-workshop-text hover:border-workshop-text/30"
            }`}
          >
            {f.label}
            {f.value !== "all" && (
              <span className="ml-1 opacity-60">
                ({initialMessages.filter((m) => m.status === f.value).length})
              </span>
            )}
          </button>
        ))}
        <span className="text-xs text-workshop-muted ml-auto">
          {filtered.length} meddelanden
        </span>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="bg-workshop-surface border border-workshop-border rounded-lg p-8 text-center">
          <MessageSquare className="h-10 w-10 text-workshop-muted/40 mx-auto mb-3" />
          <p className="text-workshop-muted text-sm">
            {initialMessages.length === 0
              ? "Inga meddelanden har skickats ännu"
              : "Inga meddelanden matchar filtret"}
          </p>
        </div>
      )}

      {/* Message list */}
      <div className="space-y-2">
        {filtered.map((msg) => {
          const statusCfg = STATUS_CONFIG[msg.status] ?? STATUS_CONFIG.sent;
          const StatusIcon = statusCfg.icon;
          const isExpanded = expanded === msg.id;

          const customerName = msg.customerCompany
            ?? [msg.customerFirstName, msg.customerLastName].filter(Boolean).join(" ")
            ?? msg.recipientName
            ?? "Okänd";

          const sentDate = new Date(msg.sentAt);
          const timeStr = sentDate.toLocaleString("sv-SE", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={msg.id}
              className="bg-workshop-surface border border-workshop-border rounded-lg hover:border-workshop-text/20 transition-colors cursor-pointer"
              onClick={() => setExpanded(isExpanded ? null : msg.id)}
            >
              <div className="flex items-center gap-3 p-3">
                {/* Channel icon */}
                <div className="flex-shrink-0">
                  {msg.channel === "sms" ? (
                    <Phone className="h-4 w-4 text-workshop-accent" />
                  ) : (
                    <Mail className="h-4 w-4 text-blue-400" />
                  )}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-workshop-text truncate">
                      {customerName}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-workshop-elevated text-workshop-muted">
                      {TYPE_LABELS[msg.type] ?? msg.type}
                    </span>
                  </div>
                  <p className="text-xs text-workshop-muted truncate mt-0.5">
                    {msg.recipientPhone ?? msg.recipientEmail ?? "—"}
                    {" · "}
                    {msg.message.slice(0, 60)}{msg.message.length > 60 ? "..." : ""}
                  </p>
                </div>

                {/* Status + time */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`inline-flex items-center gap-1 text-xs ${statusCfg.color}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {statusCfg.label}
                  </span>
                  <span className="text-xs text-workshop-muted flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {timeStr}
                  </span>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-workshop-border p-3 space-y-2 text-sm">
                  <div className="bg-workshop-elevated rounded p-3">
                    <p className="text-workshop-text whitespace-pre-wrap">{msg.message}</p>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-workshop-muted">
                    <span>Kanal: {msg.channel.toUpperCase()}</span>
                    <span>Typ: {TYPE_LABELS[msg.type] ?? msg.type}</span>
                    {msg.recipientPhone && <span>Tel: {msg.recipientPhone}</span>}
                    {msg.recipientEmail && <span>E-post: {msg.recipientEmail}</span>}
                    {msg.externalId && <span>Externt ID: {msg.externalId}</span>}
                    {msg.costSek != null && <span>Kostnad: {(msg.costSek / 100).toFixed(2)} kr</span>}
                    {msg.relatedEntityType && <span>Kopplad till: {msg.relatedEntityType}</span>}
                    <span>Skickat: {new Date(msg.sentAt).toLocaleString("sv-SE")}</span>
                  </div>
                  {msg.errorMessage && (
                    <div className="bg-red-500/10 text-red-400 text-xs rounded p-2">
                      Fel: {msg.errorMessage}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
