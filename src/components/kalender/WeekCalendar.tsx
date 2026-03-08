"use client";

import { useState, useMemo, useEffect } from "react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { sv } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Eye, Clock } from "lucide-react";
import Link from "next/link";

// ───── types ─────
interface Appointment {
  id: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  serviceDescription: string | null;
  resourceId: string | null;
  vehicleRegNr: string;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  customerFirst: string | null;
  customerLast: string | null;
  customerCo: string | null;
}

interface Resource {
  id: string;
  name: string;
  resourceType: string;
}

interface OpeningHour {
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  isClosed: string;
}

interface Props {
  appointments: Appointment[];
  resources: Resource[];
  openingHours: OpeningHour[];
  weekOffset: number;
  weekStart: string; // ISO
}

// ───── constants ─────
const HOUR_HEIGHT = 64; // px per hour
const MIN_HOUR = 6;
const MAX_HOUR = 19;
const HOURS = Array.from({ length: MAX_HOUR - MIN_HOUR }, (_, i) => MIN_HOUR + i);

// ───── helpers ─────
function timeToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function getTopPx(date: Date): number {
  const mins = timeToMinutes(date) - MIN_HOUR * 60;
  return (mins / 60) * HOUR_HEIGHT;
}

function getHeightPx(start: Date, end: Date): number {
  const durationMins = (end.getTime() - start.getTime()) / 60000;
  return Math.max((durationMins / 60) * HOUR_HEIGHT, 24);
}

const statusStyles: Record<string, { bg: string; border: string; text: string }> = {
  confirmed: { bg: "bg-emerald-900/70", border: "border-emerald-500", text: "text-emerald-100" },
  pending:   { bg: "bg-amber-900/70", border: "border-amber-500", text: "text-amber-100" },
};

export default function WeekCalendar({ appointments, resources, openingHours, weekOffset, weekStart: wsISO }: Props) {
  const weekStartDate = new Date(wsISO);
  const weekdays = Array.from({ length: 5 }, (_, i) => addDays(weekStartDate, i));
  const today = new Date();

  // ───── current time indicator ─────
  const [now, setNow] = useState(new Date());
  // update every minute
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(iv);
  }, []);

  // ───── group appointments by resource+day ─────
  const apptMap = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appt of appointments) {
      const start = new Date(appt.scheduledStart);
      const dayStr = format(start, "yyyy-MM-dd");
      const key = `${appt.resourceId ?? "unassigned"}_${dayStr}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(appt);
    }
    return map;
  }, [appointments]);

  // ───── opening hours map ─────
  const ohMap = useMemo(() => {
    const m = new Map<number, OpeningHour>();
    for (const oh of openingHours) {
      m.set(parseInt(oh.dayOfWeek), oh);
    }
    return m;
  }, [openingHours]);

  // Get working hours range for a day
  function getDayRange(day: Date): { open: number; close: number; closed: boolean } {
    const dow = day.getDay() === 0 ? 7 : day.getDay(); // ISO weekday
    const oh = ohMap.get(dow);
    if (!oh || oh.isClosed === "true") return { open: 8, close: 17, closed: true };
    const openH = parseInt(oh.openTime?.split(":")[0] ?? "8");
    const closeH = parseInt(oh.closeTime?.split(":")[0] ?? "17");
    return { open: openH, close: closeH, closed: false };
  }

  const prevWeek = weekOffset - 1;
  const nextWeek = weekOffset + 1;

  // If no resources, show empty state
  if (resources.length === 0) {
    return (
      <div className="space-y-4">
        <CalendarHeader weekStart={weekStartDate} weekdays={weekdays} prevWeek={prevWeek} nextWeek={nextWeek} weekOffset={weekOffset} />
        <div className="surface p-12 text-center">
          <Clock className="h-12 w-12 text-workshop-muted mx-auto mb-4" />
          <h3 className="text-lg text-workshop-text font-medium mb-2">Inga resurser konfigurerade</h3>
          <p className="text-workshop-muted mb-4">Lägg till liftar och arbetsplatser för att se kalendern.</p>
          <Link href="/installningar/resurser" className="inline-flex items-center gap-2 px-4 py-2 bg-workshop-accent text-white rounded-md text-sm font-medium hover:bg-workshop-accent-hover">
            Konfigurera resurser
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CalendarHeader weekStart={weekStartDate} weekdays={weekdays} prevWeek={prevWeek} nextWeek={nextWeek} weekOffset={weekOffset} />

      {/* Main calendar grid */}
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${120 + resources.length * 5 * 160}px` }}>
            {/* ─── Sticky header: Days + Resources ─── */}
            <div className="sticky top-0 z-20 bg-workshop-surface border-b-2 border-workshop-border">
              {/* Day header row */}
              <div className="grid" style={{ gridTemplateColumns: `56px repeat(${weekdays.length}, 1fr)` }}>
                <div className="border-r border-workshop-border" />
                {weekdays.map((day) => {
                  const isToday = isSameDay(day, today);
                  const dayRange = getDayRange(day);
                  return (
                    <div
                      key={day.toISOString()}
                      className={`border-r border-workshop-border text-center py-2 ${isToday ? "bg-workshop-accent/10" : ""}`}
                    >
                      <span className={`text-xs uppercase tracking-wider block ${isToday ? "text-workshop-accent font-bold" : "text-workshop-muted"}`}>
                        {format(day, "EEE", { locale: sv })}
                      </span>
                      <Link href={`/kalender/dag?date=${format(day, "yyyy-MM-dd")}`}>
                        <span className={`text-xl font-bold inline-flex items-center justify-center w-9 h-9 rounded-full ${
                          isToday ? "bg-workshop-accent text-white" : "text-workshop-text hover:bg-workshop-elevated"
                        }`}>
                          {format(day, "d")}
                        </span>
                      </Link>
                      {dayRange.closed && (
                        <span className="text-[10px] text-red-400 block">Stängt</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Resource sub-header row */}
              <div className="grid border-t border-workshop-border" style={{ gridTemplateColumns: `56px repeat(${weekdays.length}, 1fr)` }}>
                <div className="border-r border-workshop-border bg-workshop-elevated px-1 py-1.5 flex items-center">
                  <span className="text-[10px] text-workshop-muted uppercase tracking-wider">Tid</span>
                </div>
                {weekdays.map((day) => (
                  <div key={day.toISOString()} className="grid border-r border-workshop-border" style={{ gridTemplateColumns: `repeat(${resources.length}, 1fr)` }}>
                    {resources.map((res, ri) => (
                      <div
                        key={res.id}
                        className={`px-1 py-1.5 text-center ${ri < resources.length - 1 ? "border-r border-workshop-border/50" : ""} bg-workshop-elevated/50`}
                      >
                        <span className="text-[10px] font-medium text-workshop-text truncate block">{res.name}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* ─── Time grid body ─── */}
            <div className="relative" style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}>
              {/* Hour lines */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-t border-workshop-border/40"
                  style={{ top: `${(hour - MIN_HOUR) * HOUR_HEIGHT}px` }}
                >
                  {/* Hour label */}
                  <div className="absolute left-0 w-[56px] -top-[10px] text-right pr-2">
                    <span className="text-[11px] text-workshop-muted font-mono">
                      {String(hour).padStart(2, "0")}:00
                    </span>
                  </div>
                  {/* Half-hour dashed line */}
                  <div
                    className="absolute left-[56px] right-0 border-t border-dashed border-workshop-border/20"
                    style={{ top: `${HOUR_HEIGHT / 2}px` }}
                  />
                </div>
              ))}

              {/* ─── Day + Resource columns ─── */}
              <div className="absolute left-[56px] right-0 top-0 bottom-0 grid" style={{ gridTemplateColumns: `repeat(${weekdays.length}, 1fr)` }}>
                {weekdays.map((day) => {
                  const dayStr = format(day, "yyyy-MM-dd");
                  const isToday = isSameDay(day, today);
                  const dayRange = getDayRange(day);

                  return (
                    <div key={dayStr} className={`relative border-r border-workshop-border grid`} style={{ gridTemplateColumns: `repeat(${resources.length}, 1fr)` }}>
                      {/* Closed overlay */}
                      {dayRange.closed && (
                        <div className="absolute inset-0 bg-red-900/5 z-[1] pointer-events-none flex items-center justify-center">
                          <span className="text-red-400/30 font-bold text-2xl rotate-[-30deg]">STÄNGT</span>
                        </div>
                      )}

                      {/* Outside working hours shading */}
                      {!dayRange.closed && (
                        <>
                          <div
                            className="absolute left-0 right-0 bg-workshop-bg/40 z-[1] pointer-events-none"
                            style={{ top: 0, height: `${Math.max(0, (dayRange.open - MIN_HOUR)) * HOUR_HEIGHT}px` }}
                          />
                          <div
                            className="absolute left-0 right-0 bg-workshop-bg/40 z-[1] pointer-events-none"
                            style={{ top: `${(dayRange.close - MIN_HOUR) * HOUR_HEIGHT}px`, bottom: 0 }}
                          />
                        </>
                      )}

                      {resources.map((res, ri) => {
                        const key = `${res.id}_${dayStr}`;
                        const dayAppts = apptMap.get(key) ?? [];

                        return (
                          <div
                            key={res.id}
                            className={`relative ${ri < resources.length - 1 ? "border-r border-workshop-border/30" : ""} ${isToday ? "bg-workshop-accent/[0.03]" : ""}`}
                          >
                            {/* Appointment blocks */}
                            {dayAppts.map((appt) => {
                              const start = new Date(appt.scheduledStart);
                              const end = new Date(appt.scheduledEnd);
                              const top = getTopPx(start);
                              const height = getHeightPx(start, end);
                              const style = statusStyles[appt.status] ?? statusStyles.pending;

                              return (
                                <Link
                                  key={appt.id}
                                  href={`/kalender/dag?date=${dayStr}`}
                                  className={`absolute left-0.5 right-0.5 z-10 rounded-md border-l-[3px] ${style.bg} ${style.border} ${style.text} hover:brightness-125 transition-all overflow-hidden group cursor-pointer`}
                                  style={{ top: `${top}px`, height: `${height}px`, minHeight: "24px" }}
                                  title={`${appt.vehicleRegNr} — ${appt.vehicleBrand ?? ""} ${appt.vehicleModel ?? ""}\n${format(start, "HH:mm")}–${format(end, "HH:mm")}\n${appt.serviceDescription ?? ""}`}
                                >
                                  <div className="px-1.5 py-1 overflow-hidden h-full">
                                    <div className="flex items-center gap-1 text-[11px] font-bold truncate">
                                      <span className="font-mono tracking-wide">{appt.vehicleRegNr}</span>
                                    </div>
                                    {height > 32 && (
                                      <div className="text-[10px] opacity-80 font-mono">
                                        {format(start, "HH:mm")}–{format(end, "HH:mm")}
                                      </div>
                                    )}
                                    {height > 48 && appt.serviceDescription && (
                                      <div className="text-[10px] opacity-70 truncate mt-0.5">
                                        {appt.serviceDescription}
                                      </div>
                                    )}
                                    {height > 64 && (
                                      <div className="text-[10px] opacity-60 truncate">
                                        {appt.customerCo ?? `${appt.customerFirst ?? ""} ${appt.customerLast ?? ""}`.trim()}
                                      </div>
                                    )}
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        );
                      })}

                      {/* Current time indicator */}
                      {isToday && (
                        <div
                          className="absolute left-0 right-0 z-[15] pointer-events-none"
                          style={{ top: `${getTopPx(now)}px` }}
                        >
                          <div className="relative flex items-center">
                            <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                            <div className="flex-1 h-[2px] bg-red-500" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───── Header sub-component ─────
function CalendarHeader({
  weekStart,
  weekdays,
  prevWeek,
  nextWeek,
  weekOffset,
}: {
  weekStart: Date;
  weekdays: Date[];
  prevWeek: number;
  nextWeek: number;
  weekOffset: number;
}) {
  const weekEnd = weekdays[weekdays.length - 1];
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 className="text-2xl font-bold text-workshop-text">Kalender</h1>
        <p className="text-workshop-muted text-sm">
          v.{format(weekStart, "w")} &mdash;{" "}
          <span className="capitalize">{format(weekStart, "d MMM", { locale: sv })}</span>
          {" – "}
          <span className="capitalize">{format(weekEnd, "d MMM yyyy", { locale: sv })}</span>
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`/kalender?week=${prevWeek}`}
          className="p-2 bg-workshop-surface border border-workshop-border rounded-md hover:bg-workshop-elevated transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-workshop-text" />
        </Link>
        <Link
          href="/kalender"
          className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            weekOffset === 0
              ? "bg-workshop-accent text-white"
              : "bg-workshop-surface border border-workshop-border text-workshop-text hover:bg-workshop-elevated"
          }`}
        >
          Denna vecka
        </Link>
        <Link
          href={`/kalender?week=${nextWeek}`}
          className="p-2 bg-workshop-surface border border-workshop-border rounded-md hover:bg-workshop-elevated transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-workshop-text" />
        </Link>

        <div className="w-px h-6 bg-workshop-border mx-1" />

        <Link
          href="/kalender/dag"
          className="flex items-center gap-1.5 px-3 py-2 bg-workshop-surface border border-workshop-border rounded-md text-sm text-workshop-muted hover:text-workshop-text hover:bg-workshop-elevated transition-colors"
        >
          <Eye className="h-4 w-4" />
          Dagvy
        </Link>

        <Link
          href="/kalender/ny"
          className="flex items-center gap-2 px-4 py-2 bg-workshop-accent hover:bg-workshop-accent-hover text-white rounded-md text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          Ny bokning
        </Link>
      </div>
    </div>
  );
}
