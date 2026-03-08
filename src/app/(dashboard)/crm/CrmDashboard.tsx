"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Send, CheckCircle2, XCircle, Loader2, RefreshCw,
  Wrench, Shield, CircleDot, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Reminder {
  id: string;
  type: string;
  title: string;
  message: string;
  dueDate: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
  customerName: string | null;
  customerLast: string | null;
  companyName: string | null;
  phone: string | null;
  regNr: string | null;
  brand: string | null;
  model: string | null;
}

const TABS = [
  { key: "all", label: "Alla", icon: MessageSquare },
  { key: "service", label: "Service", icon: Wrench },
  { key: "inspection", label: "Besiktning", icon: Shield },
  { key: "tire_change", label: "Däckbyte", icon: CircleDot },
] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500",
  approved: "bg-blue-500/10 text-blue-500",
  sent: "bg-green-500/10 text-green-500",
  dismissed: "bg-gray-500/10 text-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Väntar",
  approved: "Godkänd",
  sent: "Skickad",
  dismissed: "Avfärdad",
};

export function CrmDashboard({ initialReminders }: { initialReminders: Reminder[] }) {
  const router = useRouter();
  const [reminders, setReminders] = useState(initialReminders);
  const [activeTab, setActiveTab] = useState("all");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  const filtered = activeTab === "all"
    ? reminders
    : reminders.filter((r) => r.type === activeTab);

  const pendingCount = reminders.filter((r) => r.status === "pending").length;
  const approvedCount = reminders.filter((r) => r.status === "approved").length;

  // Generate reminders for a type
  const generateReminders = async (type: string) => {
    setGenerating(true);
    try {
      const res = await fetch("/api/crm/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (data.created > 0) {
        router.refresh();
        // Refetch
        const listRes = await fetch("/api/crm/reminders");
        const listData = await listRes.json();
        setReminders(listData);
      }
    } finally {
      setGenerating(false);
    }
  };

  // Approve/dismiss a reminder
  const updateStatus = useCallback(async (id: string, status: "approved" | "dismissed") => {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r)),
    );
    await fetch(`/api/crm/reminders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }, []);

  // Send all approved
  const sendApproved = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/crm/reminders/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.sent > 0) {
        setReminders((prev) =>
          prev.map((r) =>
            r.status === "approved" ? { ...r, status: "sent", sentAt: new Date().toISOString() } : r,
          ),
        );
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => generateReminders("inspection")}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-workshop-card border border-workshop-border text-sm text-workshop-text hover:bg-workshop-border transition-colors"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Generera besiktningspåminnelser
        </button>

        {approvedCount > 0 && (
          <button
            onClick={sendApproved}
            disabled={sending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Skicka godkända ({approvedCount})
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-workshop-dark rounded-lg p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count = tab.key === "all"
            ? reminders.length
            : reminders.filter((r) => r.type === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? "bg-workshop-card text-workshop-text shadow-sm"
                  : "text-workshop-muted hover:text-workshop-text",
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {count > 0 && (
                <span className="bg-workshop-border text-workshop-muted text-xs px-1.5 py-0.5 rounded-full">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Reminder list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-workshop-muted">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Inga påminnelser. Tryck &quot;Generera&quot; för att skapa nya.</p>
          </div>
        )}

        {filtered.map((r) => {
          const name = r.companyName ?? [r.customerName, r.customerLast].filter(Boolean).join(" ") ?? "Okänd kund";

          return (
            <div
              key={r.id}
              className="bg-workshop-card border border-workshop-border rounded-lg p-3 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-workshop-text truncate">{r.title}</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[r.status])}>
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                </div>
                <p className="text-xs text-workshop-muted truncate">
                  {name} • {r.regNr ?? "—"} {r.brand ?? ""} {r.model ?? ""} • Förfaller: {r.dueDate}
                </p>
                <p className="text-xs text-workshop-muted/70 mt-0.5 truncate italic">
                  &quot;{r.message.substring(0, 80)}...&quot;
                </p>
              </div>

              {r.status === "pending" && (
                <div className="flex gap-1">
                  <button
                    onClick={() => updateStatus(r.id, "approved")}
                    className="p-2 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors"
                    title="Godkänn"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => updateStatus(r.id, "dismissed")}
                    className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                    title="Avfärda"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
