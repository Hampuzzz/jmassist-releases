"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="sv" className="dark">
      <body className="bg-[#0a0a0a] text-[#e5e5e5] antialiased">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md px-4">
            <h2 className="text-2xl font-bold text-red-400">
              Något gick fel
            </h2>
            <p className="text-[#a3a3a3] text-sm">
              {error?.message || "Ett oväntat fel uppstod."}
            </p>
            <button
              onClick={() => reset()}
              className="px-4 py-2 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-md text-sm font-medium transition-colors"
            >
              Försök igen
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
