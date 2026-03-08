"use client";

import { useMemo, useState, useCallback, DragEvent } from "react";
import { useRouter } from "next/navigation";
import { format, isSameDay } from "date-fns";
import { sv } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, Car, Plus, Phone, Trash2 } from "lucide-react";
import Link from "next/link";

// ───── types ─────
interface Appointment {
  id: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  serviceDescription: string | null;
  customerNotes: string | null;
  resourceId: string | null;
  vehicleRegNr: string;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  customerFirst: string | null;
  customerLast: string | null;
  customerCo: string | null;
  customerPhone: string | null;
  resourceName: string | null;
}

interface Resource {
  id: string;
  name: string;
  resourceType: string;
}

interface WorkOrder {
  id: string;
  orderNumber: string | null;
  status: string;
  vehicleRegNr: string;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  customerFirst: string | null;
  customerLast: string | null;
  customerCo: string | null;
  customerComplaint: string | null;
}

interface Props {
  appointments: Appointment[];
  resources: Resource[];
  workOrders: WorkOrder[];
  targetDate: string; // ISO
  prevDate: string;
  nextDate: string;
  isToday: boolean;
}

// ───── drag-and-drop payload ─────
interface DragPayload {
  appointmentId: string;
  durationMs: number;
}

// ───── constants ─────
const HOUR_HEIGHT = 72;
const MIN_HOUR = 6;
const MAX_HOUR = 19;
const HOURS = Array.from({ length: MAX_HOUR - MIN_HOUR }, (_, i) => MIN_HOUR + i);
const HALF_HOURS = HOURS.flatMap((h) => [h, h + 0.5]);

function getTopPx(date: Date): number {
  const mins = date.getHours() * 60 + date.getMinutes() - MIN_HOUR * 60;
  return (mins / 60) * HOUR_HEIGHT;
}

function getHeightPx(start: Date, end: Date): number {
  const durationMins = (end.getTime() - start.getTime()) / 60000;
  return Math.max((durationMins / 60) * HOUR_HEIGHT, 32);
}

const statusStyles: Record<string, { bg: string; border: string; text: string }> = {
  confirmed: { bg: "bg-emerald-900/70", border: "border-emerald-500", text: "text-emerald-100" },
  pending:   { bg: "bg-amber-900/70", border: "border-amber-500", text: "text-amber-100" },
};

const woStatusLabels: Record<string, { label: string; color: string; border: string }> = {
  queued:            { label: "I kö",              color: "bg-zinc-700 text-zinc-200",   border: "border-l-zinc-500" },
  diagnosing:        { label: "Diagnostik",        color: "bg-purple-700 text-purple-100", border: "border-l-purple-500" },
  ongoing:           { label: "Pågående",          color: "bg-amber-600 text-amber-100",  border: "border-l-amber-500" },
  ordering_parts:    { label: "Beställer delar",   color: "bg-cyan-700 text-cyan-100",   border: "border-l-cyan-500" },
  waiting_for_parts: { label: "Väntar på delar",   color: "bg-blue-700 text-blue-100",   border: "border-l-blue-500" },
  ready_for_pickup:  { label: "Klar för hämtning", color: "bg-green-600 text-green-100",  border: "border-l-green-500" },
};

export default function DayCalendar({ appointments, resources, workOrders, targetDate, prevDate, nextDate, isToday }: Props) {
  const router = useRouter();
  const date = new Date(targetDate);
  const now = new Date();

  // ───── delete state ─────
  const [deletingApptId, setDeletingApptId] = useState<string | null>(null);

  const handleDeleteAppt = useCallback(async (apptId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Ta bort denna bokning permanent?")) return;
    setDeletingApptId(apptId);
    try {
      const res = await fetch(`/api/kalender/${apptId}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const body = await res.json().catch(() => null);
        alert(body?.error ?? "Kunde inte ta bort bokning.");
      }
    } catch {
      alert("Nätverksfel — kunde inte ta bort bokning.");
    } finally {
      setDeletingApptId(null);
    }
  }, [router]);

  // ───── drag-and-drop state ─────
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ resourceId: string; halfHour: number } | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, appt: Appointment) => {
    const start = new Date(appt.scheduledStart);
    const end = new Date(appt.scheduledEnd);
    const payload: DragPayload = {
      appointmentId: appt.id,
      durationMs: end.getTime() - start.getTime(),
    };
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
    // Delay so the drag image captures the element before opacity changes
    requestAnimationFrame(() => setDraggingId(appt.id));
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDropTarget(null);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, resourceId: string, halfHour: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget({ resourceId, halfHour });
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>, resourceId: string, halfHour: number) => {
    e.preventDefault();
    setDropTarget(null);
    setDraggingId(null);
    setMoveError(null);

    let payload: DragPayload;
    try {
      payload = JSON.parse(e.dataTransfer.getData("application/json"));
    } catch {
      return;
    }

    // Calculate new times
    const baseDate = new Date(targetDate);
    const hour = Math.floor(halfHour);
    const mins = (halfHour % 1) * 60;
    const newStart = new Date(baseDate);
    newStart.setHours(hour, mins, 0, 0);
    const newEnd = new Date(newStart.getTime() + payload.durationMs);

    // Resolve resourceId: "unassigned" -> null
    const newResourceId = resourceId === "unassigned" ? null : resourceId;

    setIsMoving(true);
    try {
      const res = await fetch(`/api/kalender/${payload.appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledStart: newStart.toISOString(),
          scheduledEnd: newEnd.toISOString(),
          resourceId: newResourceId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Flytt misslyckades" }));
        setMoveError(err.error ?? "Flytt misslyckades");
        setTimeout(() => setMoveError(null), 4000);
        return;
      }
      // Refresh page to reflect the change
      router.refresh();
    } catch {
      setMoveError("Nätverksfel vid flytt");
      setTimeout(() => setMoveError(null), 4000);
    } finally {
      setIsMoving(false);
    }
  }, [targetDate]);

  // Group appointments by resource
  const apptByResource = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const res of resources) {
      map.set(res.id, []);
    }
    map.set("unassigned", []);
    for (const appt of appointments) {
      const key = appt.resourceId ?? "unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(appt);
    }
    return map;
  }, [appointments, resources]);

  const hasUnassigned = (apptByResource.get("unassigned") ?? []).length > 0;
  const displayResources = hasUnassigned
    ? [...resources, { id: "unassigned", name: "Ej tilldelad", resourceType: "other" }]
    : resources;

  return (
    <div className="space-y-4">
      {/* Moving overlay */}
      {isMoving && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
          <div className="surface px-6 py-4 rounded-lg shadow-xl text-workshop-text text-sm font-medium animate-pulse">
            Flyttar bokning...
          </div>
        </div>
      )}

      {/* Error toast */}
      {moveError && (
        <div className="fixed top-4 right-4 z-50 bg-red-900/90 border border-red-500 text-red-100 px-4 py-3 rounded-lg shadow-xl text-sm max-w-sm">
          {moveError}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-workshop-text">
            {isToday ? "Idag" : <span className="capitalize">{format(date, "EEEE", { locale: sv })}</span>}
          </h1>
          <p className="text-workshop-muted text-lg capitalize">
            {format(date, "d MMMM yyyy", { locale: sv })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/kalender/dag?date=${prevDate}`} className="p-2 bg-workshop-surface border border-workshop-border rounded-md hover:bg-workshop-elevated transition-colors">
            <ChevronLeft className="h-5 w-5 text-workshop-text" />
          </Link>
          <Link
            href="/kalender/dag"
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              isToday ? "bg-workshop-accent text-white" : "bg-workshop-surface border border-workshop-border text-workshop-text hover:bg-workshop-elevated"
            }`}
          >
            Idag
          </Link>
          <Link href={`/kalender/dag?date=${nextDate}`} className="p-2 bg-workshop-surface border border-workshop-border rounded-md hover:bg-workshop-elevated transition-colors">
            <ChevronRight className="h-5 w-5 text-workshop-text" />
          </Link>

          <div className="w-px h-6 bg-workshop-border mx-1" />

          <Link href="/kalender" className="px-4 py-2 bg-workshop-surface border border-workshop-border rounded-md text-sm text-workshop-muted hover:text-workshop-text hover:bg-workshop-elevated transition-colors">
            Veckovy
          </Link>

          <Link href="/kalender/ny" className="flex items-center gap-2 px-4 py-2 bg-workshop-accent hover:bg-workshop-accent-hover text-white rounded-md text-sm font-medium transition-colors">
            <Plus className="h-4 w-4" />
            Ny bokning
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Main timeline */}
        <div className="xl:col-span-3">
          <div className="surface overflow-hidden">
            <div className="overflow-x-auto">
              <div style={{ minWidth: `${80 + displayResources.length * 180}px` }}>
                {/* Resource header */}
                <div className="sticky top-0 z-20 bg-workshop-surface border-b-2 border-workshop-border">
                  <div className="grid" style={{ gridTemplateColumns: `56px repeat(${displayResources.length}, 1fr)` }}>
                    <div className="border-r border-workshop-border bg-workshop-elevated px-1 py-3 flex items-center">
                      <span className="text-[10px] text-workshop-muted uppercase tracking-wider">Tid</span>
                    </div>
                    {displayResources.map((res, ri) => (
                      <div
                        key={res.id}
                        className={`px-3 py-3 text-center ${ri < displayResources.length - 1 ? "border-r border-workshop-border" : ""} bg-workshop-elevated/50`}
                      >
                        <span className="text-sm font-medium text-workshop-text">{res.name}</span>
                        <span className="text-[10px] text-workshop-muted capitalize block">{res.resourceType}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Time grid */}
                <div className="relative" style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}>
                  {/* Hour lines */}
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-t border-workshop-border/40"
                      style={{ top: `${(hour - MIN_HOUR) * HOUR_HEIGHT}px` }}
                    >
                      <div className="absolute left-0 w-[56px] -top-[10px] text-right pr-2">
                        <span className="text-[11px] text-workshop-muted font-mono">
                          {String(hour).padStart(2, "0")}:00
                        </span>
                      </div>
                      <div
                        className="absolute left-[56px] right-0 border-t border-dashed border-workshop-border/20"
                        style={{ top: `${HOUR_HEIGHT / 2}px` }}
                      />
                    </div>
                  ))}

                  {/* Resource columns with drop targets + appointments */}
                  <div className="absolute left-[56px] right-0 top-0 bottom-0 grid" style={{ gridTemplateColumns: `repeat(${displayResources.length}, 1fr)` }}>
                    {displayResources.map((res, ri) => {
                      const resAppts = apptByResource.get(res.id) ?? [];
                      return (
                        <div key={res.id} className={`relative ${ri < displayResources.length - 1 ? "border-r border-workshop-border/30" : ""}`}>
                          {/* Drop target cells: one per half-hour slot */}
                          {HALF_HOURS.map((hh) => {
                            const isOver = dropTarget?.resourceId === res.id && dropTarget?.halfHour === hh;
                            return (
                              <div
                                key={`drop-${res.id}-${hh}`}
                                className={`absolute left-0 right-0 z-[5] transition-colors ${
                                  isOver
                                    ? "bg-workshop-accent/20 outline outline-2 outline-workshop-accent/60 outline-offset-[-2px] rounded"
                                    : ""
                                }`}
                                style={{
                                  top: `${(hh - MIN_HOUR) * HOUR_HEIGHT}px`,
                                  height: `${HOUR_HEIGHT / 2}px`,
                                }}
                                onDragOver={(e) => handleDragOver(e, res.id, hh)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, res.id, hh)}
                              />
                            );
                          })}

                          {/* Appointment blocks (draggable) */}
                          {resAppts.map((appt) => {
                            const start = new Date(appt.scheduledStart);
                            const end = new Date(appt.scheduledEnd);
                            const top = getTopPx(start);
                            const height = getHeightPx(start, end);
                            const style = statusStyles[appt.status] ?? statusStyles.pending;
                            const customer = appt.customerCo ?? `${appt.customerFirst ?? ""} ${appt.customerLast ?? ""}`.trim();
                            const isDragging = draggingId === appt.id;

                            return (
                              <div
                                key={appt.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, appt)}
                                onDragEnd={handleDragEnd}
                                className={`group absolute left-1 right-1 z-10 rounded-lg border-l-[3px] ${style.bg} ${style.border} ${style.text} shadow-lg overflow-hidden hover:brightness-125 transition-all ${
                                  isDragging ? "opacity-40 scale-[0.97]" : "cursor-grab active:cursor-grabbing"
                                }`}
                                style={{ top: `${top}px`, height: `${height}px` }}
                              >
                                <div className="px-2.5 py-2 h-full flex flex-col gap-0.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="reg-plate text-[10px] py-0 px-1.5">{appt.vehicleRegNr}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] opacity-60 font-mono">
                                        {format(start, "HH:mm")}–{format(end, "HH:mm")}
                                      </span>
                                      <button
                                        onClick={(e) => handleDeleteAppt(appt.id, e)}
                                        disabled={deletingApptId === appt.id}
                                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-900/60 text-red-300 hover:text-red-200 transition-all"
                                        title="Ta bort bokning"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>
                                  {height > 44 && (
                                    <span className="text-xs font-medium truncate">
                                      {appt.vehicleBrand} {appt.vehicleModel}
                                    </span>
                                  )}
                                  {height > 60 && appt.serviceDescription && (
                                    <span className="text-[11px] opacity-75 truncate">
                                      {appt.serviceDescription}
                                    </span>
                                  )}
                                  {height > 76 && customer && (
                                    <div className="flex items-center gap-1 text-[10px] opacity-60 mt-auto">
                                      <span className="truncate">{customer}</span>
                                      {appt.customerPhone && (
                                        <a href={`tel:${appt.customerPhone}`} className="shrink-0 hover:text-workshop-accent">
                                          <Phone className="h-3 w-3" />
                                        </a>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>

                  {/* Current time indicator */}
                  {isToday && (
                    <div
                      className="absolute left-0 right-0 z-[15] pointer-events-none"
                      style={{ top: `${getTopPx(now)}px` }}
                    >
                      <div className="relative flex items-center">
                        <div className="absolute left-[48px] w-3 h-3 rounded-full bg-red-500" />
                        <div className="absolute left-[56px] right-0 h-[2px] bg-red-500" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: Active work orders */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-workshop-muted uppercase tracking-wider flex items-center gap-2">
            <Car className="h-4 w-4" />
            Aktiva ordrar ({workOrders.length})
          </h2>

          <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
            {workOrders.map((wo) => {
              const st = woStatusLabels[wo.status] ?? woStatusLabels.queued;
              return (
                <Link
                  key={wo.id}
                  href={`/arbetsorder/${wo.id}`}
                  className={`block surface p-3 border-l-4 ${st.border} hover:bg-workshop-elevated/50 transition-colors`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-workshop-muted font-mono">{wo.orderNumber}</span>
                    <span className="reg-plate text-[10px] py-0 px-1">{wo.vehicleRegNr}</span>
                  </div>
                  <p className="text-xs text-workshop-text truncate">
                    {wo.vehicleBrand} {wo.vehicleModel}
                  </p>
                  <p className="text-xs text-workshop-muted truncate">
                    {wo.customerCo ?? `${wo.customerFirst ?? ""} ${wo.customerLast ?? ""}`.trim()}
                  </p>
                  {wo.customerComplaint && (
                    <p className="text-[10px] text-workshop-muted/70 truncate mt-1 italic">{wo.customerComplaint}</p>
                  )}
                  <span className={`inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full ${st.color}`}>
                    {st.label}
                  </span>
                </Link>
              );
            })}

            {workOrders.length === 0 && (
              <div className="surface p-6 text-center text-workshop-muted text-sm">
                Inga aktiva ordrar
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
