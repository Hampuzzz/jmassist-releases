"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Wrench } from "lucide-react";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Felaktig e-postadress eller lösenord.");
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  };

  return (
    <div className="surface p-8 space-y-6">
      {/* Logo */}
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="p-3 bg-workshop-accent rounded-xl">
            <Wrench className="h-8 w-8 text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-workshop-text">JM Assist</h1>
        <p className="text-workshop-muted text-sm">Logga in för att fortsätta</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-workshop-text" htmlFor="email">
            E-postadress
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-3 bg-workshop-elevated border border-workshop-border
                       rounded-md text-workshop-text placeholder-workshop-muted
                       focus:outline-none focus:ring-2 focus:ring-workshop-accent"
            placeholder="namn@verkstad.se"
            autoComplete="email"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-workshop-text" htmlFor="password">
            Lösenord
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-3 bg-workshop-elevated border border-workshop-border
                       rounded-md text-workshop-text placeholder-workshop-muted
                       focus:outline-none focus:ring-2 focus:ring-workshop-accent"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-950/40 border border-red-900 px-3 py-2 rounded">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-workshop-accent hover:bg-workshop-accent-hover
                     text-white font-semibold rounded-md transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Loggar in..." : "Logga in"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-workshop-muted">Laddar...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
