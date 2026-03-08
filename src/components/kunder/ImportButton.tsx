"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { ImportCustomers } from "./ImportCustomers";

export function ImportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-green-900/30 border border-green-800 hover:bg-green-900/50 text-green-300 rounded-md text-sm font-medium transition-colors"
      >
        <FileSpreadsheet className="h-4 w-4" />
        Importera Kunder
      </button>

      {open && <ImportCustomers onClose={() => setOpen(false)} />}
    </>
  );
}
