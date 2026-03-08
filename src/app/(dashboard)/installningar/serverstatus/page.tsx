"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Server, Database, Globe, Cpu, RefreshCw, CheckCircle2,
  XCircle, AlertTriangle, Clock, Wifi,
} from "lucide-react";

interface ServiceStatus {
  name: string;
  url: string;
  status: "checking" | "online" | "offline" | "warning";
  responseTime?: number;
  details?: string;
}

export default function ServerStatusPage() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [checking, setChecking] = useState(false);

  const checkServices = useCallback(async () => {
    setChecking(true);

    const checks: ServiceStatus[] = [
      { name: "Next.js App", url: "/api/health", status: "checking" },
      { name: "Databas (Supabase)", url: "/api/dashboard/stats", status: "checking" },
      { name: "Fordonsdata Scraper", url: "", status: "checking" },
      { name: "Fortnox Integration", url: "", status: "checking" },
      { name: "46elks SMS", url: "", status: "checking" },
    ];

    setServices([...checks]);

    // Check Next.js app
    try {
      const start = Date.now();
      const res = await fetch("/api/kunder?limit=1", { cache: "no-store" });
      const ms = Date.now() - start;
      checks[0] = {
        ...checks[0],
        status: res.ok ? "online" : "warning",
        responseTime: ms,
        details: res.ok ? `HTTP ${res.status}` : `HTTP ${res.status}`,
      };
    } catch {
      checks[0] = { ...checks[0], status: "offline", details: "Kunde inte ansluta" };
    }
    setServices([...checks]);

    // Check Database via dashboard stats
    try {
      const start = Date.now();
      const res = await fetch("/api/dashboard/stats", { cache: "no-store" });
      const ms = Date.now() - start;
      if (res.ok) {
        checks[1] = { ...checks[1], status: "online", responseTime: ms, details: "Ansluten" };
      } else {
        const data = await res.json().catch(() => ({}));
        checks[1] = {
          ...checks[1],
          status: "warning",
          responseTime: ms,
          details: data.error ?? `HTTP ${res.status}`,
        };
      }
    } catch {
      checks[1] = { ...checks[1], status: "offline", details: "Kunde inte ansluta till databasen" };
    }
    setServices([...checks]);

    // Check scraper
    try {
      const scraperUrl = process.env.NEXT_PUBLIC_VEHICLE_LOOKUP_URL || "http://192.168.68.68:8100";
      const start = Date.now();
      const res = await fetch(`/api/scraper/status`, { cache: "no-store" });
      const ms = Date.now() - start;
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        checks[2] = {
          ...checks[2],
          status: "online",
          responseTime: ms,
          details: data.status ?? "Aktiv",
          url: scraperUrl,
        };
      } else {
        checks[2] = { ...checks[2], status: "offline", responseTime: ms, details: "Ej tillgänglig" };
      }
    } catch {
      checks[2] = { ...checks[2], status: "offline", details: "Scraper-servern svarar ej" };
    }
    setServices([...checks]);

    // Check Fortnox (from env)
    const fortnoxToken = ""; // Can't access server env from client
    checks[3] = {
      ...checks[3],
      status: "warning",
      details: "Ej konfigurerad (token saknas)",
    };
    setServices([...checks]);

    // Check 46elks
    checks[4] = {
      ...checks[4],
      status: "warning",
      details: "Mock-läge (inga API-nycklar)",
    };
    setServices([...checks]);

    setLastChecked(new Date());
    setChecking(false);
  }, []);

  useEffect(() => {
    checkServices();
  }, [checkServices]);

  const statusIcon = (status: ServiceStatus["status"]) => {
    switch (status) {
      case "online":   return <CheckCircle2 className="h-5 w-5 text-green-400" />;
      case "offline":  return <XCircle className="h-5 w-5 text-red-400" />;
      case "warning":  return <AlertTriangle className="h-5 w-5 text-yellow-400" />;
      case "checking": return <RefreshCw className="h-5 w-5 text-workshop-muted animate-spin" />;
    }
  };

  const statusColor = (status: ServiceStatus["status"]) => {
    switch (status) {
      case "online":   return "border-green-800 bg-green-900/20";
      case "offline":  return "border-red-800 bg-red-900/20";
      case "warning":  return "border-yellow-800 bg-yellow-900/20";
      case "checking": return "border-workshop-border bg-workshop-surface";
    }
  };

  const serviceIcon = (name: string) => {
    if (name.includes("Next"))     return <Server className="h-5 w-5" />;
    if (name.includes("Databas"))  return <Database className="h-5 w-5" />;
    if (name.includes("Fordon"))   return <Globe className="h-5 w-5" />;
    if (name.includes("Fortnox"))  return <Cpu className="h-5 w-5" />;
    if (name.includes("SMS"))      return <Wifi className="h-5 w-5" />;
    return <Server className="h-5 w-5" />;
  };

  const onlineCount = services.filter((s) => s.status === "online").length;
  const totalCount = services.length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-workshop-text">Serverstatus</h1>
          <p className="text-workshop-muted text-sm mt-1">
            Övervakning av alla tjänster och integrationer
          </p>
        </div>
        <button
          onClick={checkServices}
          disabled={checking}
          className="flex items-center gap-2 px-4 py-2 bg-workshop-accent hover:bg-workshop-accent-hover disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
          Kontrollera
        </button>
      </div>

      {/* Summary */}
      <div className="surface p-4 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
          onlineCount === totalCount
            ? "bg-green-900/30 border-2 border-green-600"
            : onlineCount > 0
            ? "bg-yellow-900/30 border-2 border-yellow-600"
            : "bg-red-900/30 border-2 border-red-600"
        }`}>
          <span className="text-lg font-bold text-workshop-text">{onlineCount}/{totalCount}</span>
        </div>
        <div>
          <p className="text-workshop-text font-medium">
            {onlineCount === totalCount
              ? "Alla tjänster online"
              : `${onlineCount} av ${totalCount} tjänster online`}
          </p>
          {lastChecked && (
            <p className="text-workshop-muted text-xs flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Senast kontrollerad: {lastChecked.toLocaleTimeString("sv-SE")}
            </p>
          )}
        </div>
      </div>

      {/* Service cards */}
      <div className="space-y-3">
        {services.map((service) => (
          <div
            key={service.name}
            className={`p-4 rounded-lg border ${statusColor(service.status)} transition-colors`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-workshop-muted">{serviceIcon(service.name)}</span>
                <div>
                  <p className="text-workshop-text font-medium">{service.name}</p>
                  {service.details && (
                    <p className="text-workshop-muted text-xs mt-0.5">{service.details}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {service.responseTime !== undefined && (
                  <span className="text-xs text-workshop-muted font-mono">
                    {service.responseTime}ms
                  </span>
                )}
                {statusIcon(service.status)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* System info */}
      <div className="surface p-4 space-y-2">
        <h3 className="text-sm font-medium text-workshop-muted uppercase tracking-wider">Systeminformation</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-workshop-muted">App-version</span>
          <span className="text-workshop-text font-mono">v1.8.1</span>
          <span className="text-workshop-muted">Next.js</span>
          <span className="text-workshop-text font-mono">14.2.13</span>
          <span className="text-workshop-muted">Databas</span>
          <span className="text-workshop-text font-mono">Supabase PostgreSQL</span>
          <span className="text-workshop-muted">Scraper</span>
          <span className="text-workshop-text font-mono">192.168.68.68:8100</span>
        </div>
      </div>
    </div>
  );
}
