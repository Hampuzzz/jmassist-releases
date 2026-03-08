"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, X, FileSpreadsheet, ChevronRight, ChevronLeft,
  Loader2, CheckCircle2, AlertCircle, ArrowRight, Car,
} from "lucide-react";

// ─── UTF-8 string cleanup ────────────────────────────────────────────────
function cleanStr(s: unknown): string {
  if (s === null || s === undefined) return "";
  let str = String(s).trim();
  // Fix double-encoded UTF-8 (e.g. Ã¶ → ö, Ã¤ → ä, Ã¥ → å)
  try {
    // Detect mojibake: if string contains Ã followed by expected byte
    if (/Ã[¤¥¶]/.test(str) || /Ã[©]/.test(str)) {
      const bytes = new Uint8Array(Array.from(str, (c) => c.charCodeAt(0)));
      str = new TextDecoder("utf-8").decode(bytes);
    }
  } catch {
    // Keep original if decode fails
  }
  return str;
}

// ─── Brand code mapping (2-letter MK → full brand) ──────────────────────
const BRAND_MAP: Record<string, string> = {
  SA: "Saab", AU: "Audi", SD: "Subaru", VO: "Volvo", BM: "BMW",
  ME: "Mercedes", TO: "Toyota", VW: "Volkswagen", FO: "Ford",
  HO: "Honda", NI: "Nissan", MA: "Mazda", HY: "Hyundai", KI: "Kia",
  PE: "Peugeot", RE: "Renault", CI: "Citroën", OP: "Opel", SK: "Škoda",
  SE: "SEAT", PO: "Porsche", LA: "Land Rover", JE: "Jeep", CH: "Chevrolet",
  DO: "Dodge", CR: "Chrysler", CA: "Cadillac", LE: "Lexus", IN: "Infiniti",
  AC: "Acura", SU: "Suzuki", MI: "Mitsubishi", DA: "Dacia", AL: "Alfa Romeo",
  FI: "Fiat", LB: "Lamborghini", FE: "Ferrari", MB: "Maserati", RO: "Rolls-Royce",
  TE: "Tesla", CU: "Cupra", MG: "MG", BW: "BYD", LY: "Lynk & Co",
  PL: "Polestar", DS: "DS",
};

// Database fields to map to
const DB_FIELDS = [
  { key: "name",        label: "Kundnamn",              required: true },
  { key: "companyName", label: "Företagsnamn",           required: false },
  { key: "phone",       label: "Telefonnummer",         required: false },
  { key: "email",       label: "E-post",                required: false },
  { key: "street",      label: "Gatuadress",            required: false },
  { key: "postalCode",  label: "Postnummer",            required: false },
  { key: "city",        label: "Ort",                   required: false },
  { key: "orgNr",       label: "Organisationsnummer",   required: false },
  { key: "regNr",       label: "Registreringsnummer",   required: false },
  { key: "mk",          label: "Märkeskod (MK)",        required: false },
] as const;

type FieldKey = typeof DB_FIELDS[number]["key"];

type Step = "upload" | "mapping" | "preview" | "importing" | "done";

interface VehicleInfo {
  regNr: string;
  mk: string;
  brand: string;
}

interface GroupedCustomer {
  name: string;
  companyName: string;
  phone: string;
  email: string;
  street: string;
  postalCode: string;
  city: string;
  orgNr: string;
  isCompany: boolean;
  vehicles: VehicleInfo[];
}

interface ImportResult {
  created: number;
  skippedDuplicates: number;
  linkedVehicles: number;
  errors: string[];
}

export function ImportCustomers({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({} as any);
  const [isCompanyDefault, setIsCompanyDefault] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({ pct: 0, text: "" });

  // Grouped customer data (derived from rawRows + mapping)
  const [groupedCustomers, setGroupedCustomers] = useState<GroupedCustomer[]>([]);

  // ─── Step 1: File Upload ─────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    setError("");
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xls", "xlsx", "csv"].includes(ext ?? "")) {
      setError("Filtypen stöds inte. Använd .xlsx, .xls eller .csv.");
      return;
    }

    setFileName(file.name);

    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      // Try UTF-8 first, then fallback to Windows-1252 (common for Swedish Excel)
      const workbook = XLSX.read(data, { type: "array", codepage: 65001, raw: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false });

      if (json.length < 2) {
        setError("Filen verkar vara tom eller saknar datarader.");
        return;
      }

      const headerRow = json[0].map((h) => cleanStr(h));
      const dataRows = json.slice(1).filter((r) => r.some((c) => c !== null && c !== undefined && c !== ""));

      setHeaders(headerRow);
      setRawRows(dataRows.map((r) => r.map(String)));

      // Auto-map columns by name matching
      const autoMapping: Record<string, string> = {};
      const lowerHeaders = headerRow.map((h) => h.toLowerCase().trim());

      const autoPatterns: Record<FieldKey, string[]> = {
        name:        ["namn", "kundnamn", "name", "customer", "fullname", "förnamn"],
        companyName: ["företag", "company", "företagsnamn", "bolag", "firma"],
        phone:       ["telefon", "phone", "tel", "mobil", "mobilnummer", "telefonnummer"],
        email:       ["e-post", "email", "epost", "mail"],
        street:      ["adress", "gatuadress", "address", "gata", "street"],
        postalCode:  ["postnr", "postnummer", "postal", "zip", "zipcode"],
        city:        ["ort", "stad", "city", "postort"],
        orgNr:       ["org", "orgnr", "organisationsnummer", "org.nr"],
        regNr:       ["reg", "regnr", "registreringsnummer", "reg.nr", "registreringsnr"],
        mk:          ["mk", "märke", "märkeskod", "brand", "brand_code", "billmärke"],
      };

      for (const [field, patterns] of Object.entries(autoPatterns)) {
        const idx = lowerHeaders.findIndex((h) =>
          patterns.some((p) => h.includes(p))
        );
        if (idx >= 0) {
          autoMapping[field] = headerRow[idx];
        }
      }

      setMapping(autoMapping as Record<FieldKey, string>);
      setStep("mapping");
    } catch (err) {
      setError("Kunde inte läsa filen. Kontrollera formatet.");
      console.error("[import] parse error:", err);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ─── Step 2: Column Mapping ──────────────────────────────────────
  function updateMapping(field: FieldKey, header: string) {
    setMapping((prev) => ({ ...prev, [field]: header || undefined }));
  }

  // ─── Step 3: Build grouped customers for preview ─────────────────
  function buildGroupedCustomers(): GroupedCustomer[] {
    const map = new Map<string, GroupedCustomer>();

    for (const row of rawRows) {
      const getValue = (field: FieldKey): string => {
        const headerName = mapping[field];
        if (!headerName) return "";
        const idx = headers.indexOf(headerName);
        return idx >= 0 ? cleanStr(row[idx]) : "";
      };

      const name = getValue("name");
      if (!name) continue;

      const phone = getValue("phone");
      const email = getValue("email");
      const regNr = getValue("regNr").toUpperCase().replace(/[\s-]/g, "");
      const mk = getValue("mk").toUpperCase();

      // Group key: name + phone (same person might appear on multiple rows with different vehicles)
      const key = `${name}|${phone}`;

      if (!map.has(key)) {
        const companyName = getValue("companyName");
        const orgNr = getValue("orgNr");
        const isCompany = isCompanyDefault || !!(companyName || orgNr);

        map.set(key, {
          name,
          companyName,
          phone,
          email,
          street: getValue("street"),
          postalCode: getValue("postalCode"),
          city: getValue("city"),
          orgNr,
          isCompany,
          vehicles: [],
        });
      }

      // Add vehicle if regNr present and not already added
      if (regNr) {
        const customer = map.get(key)!;
        const alreadyAdded = customer.vehicles.some((v) => v.regNr === regNr);
        if (!alreadyAdded) {
          const brand = BRAND_MAP[mk] ?? mk ?? "";
          customer.vehicles.push({ regNr, mk, brand });
        }
      }
    }

    return Array.from(map.values());
  }

  function goToPreview() {
    const grouped = buildGroupedCustomers();
    setGroupedCustomers(grouped);
    setStep("preview");
  }

  // ─── Step 4: Import ──────────────────────────────────────────────
  async function startImport() {
    setImporting(true);
    setError("");
    setProgress({ pct: 0, text: "Förbereder..." });

    try {
      setProgress({ pct: 10, text: "Skickar data till servern..." });

      const res = await fetch("/api/kunder/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customers: groupedCustomers }),
      });

      setProgress({ pct: 80, text: "Bearbetar svar..." });

      const body = await res.json();
      if (res.ok) {
        setImportResult(body.data);
        setProgress({ pct: 100, text: "Klar!" });
        setStep("done");
      } else {
        setError(body.error ?? "Import misslyckades.");
      }
    } catch {
      setError("Nätverksfel vid import.");
    } finally {
      setImporting(false);
    }
  }

  // ─── Counts ────────────────────────────────────────────────────────
  const totalVehicles = groupedCustomers.reduce((s, c) => s + c.vehicles.length, 0);

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-3xl bg-workshop-surface border border-workshop-border rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-workshop-border">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-green-400" />
            <h2 className="text-lg font-semibold text-workshop-text">Importera Kunder</h2>
            {step === "preview" && (
              <span className="text-xs text-workshop-muted">
                {groupedCustomers.length} kunder · {totalVehicles} fordon
              </span>
            )}
            {step !== "upload" && step !== "preview" && step !== "done" && (
              <span className="text-xs text-workshop-muted">
                {rawRows.length} rader
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 text-workshop-muted hover:text-workshop-text">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 px-4 py-2 bg-workshop-elevated/50 text-xs">
          {(["Ladda upp", "Kolumnmappning", "Förhandsgranska", "Klar"] as const).map((label, i) => {
            const stepNames: Step[] = ["upload", "mapping", "preview", "done"];
            const currentIdx = step === "importing" ? 2 : stepNames.indexOf(step);
            const isActive = currentIdx >= i;
            return (
              <span key={label} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 text-workshop-muted" />}
                <span className={isActive ? "text-workshop-accent font-medium" : "text-workshop-muted"}>
                  {label}
                </span>
              </span>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-900/20 text-red-400 rounded-lg text-sm mb-4">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* ─── UPLOAD STEP ─── */}
          {step === "upload" && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-workshop-border rounded-xl p-12 text-center cursor-pointer hover:border-workshop-accent/50 transition-colors"
            >
              <Upload className="h-12 w-12 text-workshop-muted mx-auto mb-4" />
              <p className="text-workshop-text font-medium">
                Dra och släpp en Excel-fil här
              </p>
              <p className="text-workshop-muted text-sm mt-1">
                eller klicka för att välja fil (.xlsx, .xls, .csv)
              </p>
              <p className="text-workshop-muted text-xs mt-3">
                Kolumner: NAMN, GATA, POSTNR, ORT, MOBIL, EPOST, REGNR, MK
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          )}

          {/* ─── MAPPING STEP ─── */}
          {step === "mapping" && (
            <div className="space-y-4">
              <p className="text-sm text-workshop-muted">
                Mappa kolumner från <span className="text-workshop-text font-medium">{fileName}</span> till databasfält:
              </p>

              <div className="space-y-3">
                {DB_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center gap-3">
                    <label className="w-44 text-sm text-workshop-text shrink-0">
                      {field.label}
                      {field.required && <span className="text-red-400 ml-0.5">*</span>}
                    </label>
                    <ArrowRight className="h-4 w-4 text-workshop-muted shrink-0" />
                    <select
                      value={mapping[field.key] ?? ""}
                      onChange={(e) => updateMapping(field.key, e.target.value)}
                      className="flex-1 px-3 py-2 bg-workshop-elevated border border-workshop-border rounded-md text-sm text-workshop-text"
                    >
                      <option value="">-- Välj kolumn --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Company toggle */}
              <div className="flex items-center gap-3 pt-2 border-t border-workshop-border">
                <label className="flex items-center gap-2 text-sm text-workshop-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isCompanyDefault}
                    onChange={(e) => setIsCompanyDefault(e.target.checked)}
                    className="w-4 h-4 rounded border-workshop-border bg-workshop-elevated text-workshop-accent focus:ring-workshop-accent"
                  />
                  Alla rader är företag
                </label>
                <span className="text-xs text-workshop-muted">
                  (annars: företag om Företagsnamn/OrgNr finns)
                </span>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => { setStep("upload"); setHeaders([]); setRawRows([]); }}
                  className="flex items-center gap-1 px-4 py-2 text-sm text-workshop-muted hover:text-workshop-text"
                >
                  <ChevronLeft className="h-4 w-4" /> Tillbaka
                </button>
                <button
                  onClick={goToPreview}
                  disabled={!mapping.name}
                  className="flex items-center gap-1 px-4 py-2 bg-workshop-accent hover:bg-workshop-accent-hover text-white rounded-md text-sm font-medium disabled:opacity-50"
                >
                  Förhandsgranska <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ─── PREVIEW STEP ─── */}
          {step === "preview" && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="surface p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-workshop-accent">{groupedCustomers.length}</p>
                  <p className="text-xs text-workshop-muted">Unika kunder</p>
                </div>
                <div className="surface p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-400">{totalVehicles}</p>
                  <p className="text-xs text-workshop-muted">Fordon</p>
                </div>
                <div className="surface p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-workshop-muted">{rawRows.length}</p>
                  <p className="text-xs text-workshop-muted">Rader i filen</p>
                </div>
              </div>

              <p className="text-sm text-workshop-muted">
                Kunder grupperade per namn + telefon. Visar {Math.min(groupedCustomers.length, 100)} av {groupedCustomers.length}:
              </p>

              <div className="overflow-x-auto border border-workshop-border rounded-lg max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0">
                    <tr className="bg-workshop-elevated">
                      <th className="px-3 py-2 text-left font-medium text-workshop-muted">#</th>
                      <th className="px-3 py-2 text-left font-medium text-workshop-muted">Namn</th>
                      <th className="px-3 py-2 text-left font-medium text-workshop-muted">Telefon</th>
                      <th className="px-3 py-2 text-left font-medium text-workshop-muted">Ort</th>
                      <th className="px-3 py-2 text-left font-medium text-workshop-muted">Fordon</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedCustomers.slice(0, 100).map((c, i) => (
                      <tr key={i} className="border-t border-workshop-border hover:bg-workshop-elevated/30">
                        <td className="px-3 py-1.5 text-workshop-muted">{i + 1}</td>
                        <td className="px-3 py-1.5 text-workshop-text">{c.name}</td>
                        <td className="px-3 py-1.5 text-workshop-text">{c.phone || "–"}</td>
                        <td className="px-3 py-1.5 text-workshop-text">{c.city || "–"}</td>
                        <td className="px-3 py-1.5" style={{ maxWidth: "280px", whiteSpace: "normal" }}>
                          {c.vehicles.length === 0
                            ? <span className="text-workshop-muted">–</span>
                            : c.vehicles.map((v) => (
                                <span
                                  key={v.regNr}
                                  className="inline-block mr-1 mb-1 px-1.5 py-0.5 bg-green-900/30 text-green-300 border border-green-800/50 rounded text-[10px]"
                                >
                                  {v.regNr}{v.brand ? ` · ${v.brand}` : ""}
                                </span>
                              ))
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {groupedCustomers.length > 100 && (
                  <p className="text-center text-workshop-muted text-xs py-2">
                    ... och {groupedCustomers.length - 100} kunder till
                  </p>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep("mapping")}
                  className="flex items-center gap-1 px-4 py-2 text-sm text-workshop-muted hover:text-workshop-text"
                >
                  <ChevronLeft className="h-4 w-4" /> Tillbaka
                </button>
                <button
                  onClick={startImport}
                  disabled={importing}
                  className="flex items-center gap-2 px-6 py-2.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm font-medium disabled:opacity-50"
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importerar...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Importera {groupedCustomers.length} kunder
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ─── IMPORTING STEP ─── */}
          {step === "importing" && (
            <div className="space-y-4 text-center py-6">
              <Loader2 className="h-12 w-12 text-workshop-accent mx-auto animate-spin" />
              <h3 className="text-lg font-semibold text-workshop-text">Importerar...</h3>
              <div className="max-w-sm mx-auto">
                <div className="h-2 bg-workshop-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full bg-workshop-accent rounded-full transition-all duration-300"
                    style={{ width: `${progress.pct}%` }}
                  />
                </div>
                <p className="text-xs text-workshop-muted mt-2">{progress.text}</p>
              </div>
            </div>
          )}

          {/* ─── DONE STEP ─── */}
          {step === "done" && importResult && (
            <div className="space-y-4 text-center py-6">
              <CheckCircle2 className="h-14 w-14 text-green-400 mx-auto" />
              <h3 className="text-xl font-bold text-workshop-text">Import klar!</h3>

              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                <div className="surface p-3 rounded-lg">
                  <p className="text-2xl font-bold text-green-400">{importResult.created}</p>
                  <p className="text-xs text-workshop-muted">Skapade</p>
                </div>
                <div className="surface p-3 rounded-lg">
                  <p className="text-2xl font-bold text-amber-400">{importResult.skippedDuplicates}</p>
                  <p className="text-xs text-workshop-muted">Dubbletter</p>
                </div>
                <div className="surface p-3 rounded-lg">
                  <p className="text-2xl font-bold text-blue-400">{importResult.linkedVehicles}</p>
                  <p className="text-xs text-workshop-muted">Fordon länkade</p>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="text-left max-w-md mx-auto">
                  <p className="text-sm text-red-400 font-medium mb-2">
                    {importResult.errors.length} fel:
                  </p>
                  <div className="max-h-32 overflow-y-auto bg-red-900/10 rounded-lg p-3 text-xs text-red-300 space-y-1">
                    {importResult.errors.map((err, i) => (
                      <p key={i}>{err}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={() => {
                    onClose();
                    router.refresh();
                  }}
                  className="px-6 py-2.5 bg-workshop-accent hover:bg-workshop-accent-hover text-white rounded-md text-sm font-medium"
                >
                  Stäng och uppdatera
                </button>
                {importResult.linkedVehicles > 0 && (
                  <p className="text-xs text-workshop-muted">
                    Gå till <span className="text-workshop-accent">Vagnkort</span> för att berika fordonsdata automatiskt
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
