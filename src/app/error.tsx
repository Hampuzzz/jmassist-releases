"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md px-4">
        <h2 className="text-2xl font-bold text-red-400">
          Något gick fel
        </h2>
        <p className="text-workshop-muted text-sm">
          {error?.message || "Ett oväntat fel uppstod."}
        </p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-workshop-accent hover:bg-workshop-accent-hover text-white rounded-md text-sm font-medium transition-colors"
        >
          Försök igen
        </button>
      </div>
    </div>
  );
}
