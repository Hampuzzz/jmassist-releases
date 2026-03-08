import { createServerClient } from "@/lib/supabase/server";
import { signICalToken } from "@/lib/scheduling/ical";
import { Calendar, Copy } from "lucide-react";

export const metadata = { title: "Kalenderprenumeration" };

export default async function KalenderPrenumerationPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  let subscriptionUrl = "";
  try {
    if (user) {
      const token = await signICalToken(user.id);
      subscriptionUrl = `${appUrl}/api/kalender/ical?token=${token}`;
    }
  } catch (err) {
    console.error("[kalender-prenumeration] Token generation failed:", err);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-workshop-text">Kalenderprenumeration</h1>
        <p className="text-workshop-muted text-sm">
          Prenumerera på verkstadens kalender i din telefon eller dator.
        </p>
      </div>

      <div className="surface p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6 text-workshop-accent" />
          <h2 className="font-semibold text-workshop-text">Din prenumerations-URL</h2>
        </div>

        <p className="text-sm text-workshop-muted">
          Kopiera denna URL och lägg till den i din kalenderapp.
          Kalendern uppdateras automatiskt.
        </p>

        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-workshop-elevated border border-workshop-border
                           rounded px-3 py-2 text-workshop-text break-all">
            {subscriptionUrl || "Logga in för att generera URL"}
          </code>
        </div>

        <div className="space-y-2 text-sm text-workshop-muted">
          <p className="font-medium text-workshop-text">Instruktioner per app:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li><span className="text-workshop-text">Google Kalender:</span> Inställningar → Lägg till kalender → Från URL</li>
            <li><span className="text-workshop-text">Apple Kalender:</span> Arkiv → Ny kalenderprenumeration</li>
            <li><span className="text-workshop-text">Outlook:</span> Lägg till kalender → Prenumerera från webben</li>
          </ul>
        </div>

        <p className="text-xs text-workshop-muted bg-workshop-elevated rounded p-2">
          Länken är personlig och giltig i 1 år. Generera en ny om den delas av misstag.
        </p>
      </div>
    </div>
  );
}
