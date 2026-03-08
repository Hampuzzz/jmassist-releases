import Link from "next/link";
import { Clock, Wrench, Key, Calendar, Server } from "lucide-react";
import { AutoStartToggle } from "@/components/installningar/AutoStartToggle";

export const metadata = { title: "Inställningar" };

const settingsLinks = [
  {
    href:        "/installningar/oppettider",
    icon:        Clock,
    title:       "Öppettider",
    description: "Definiera öppettider och stäng specifika dagar",
  },
  {
    href:        "/installningar/resurser",
    icon:        Wrench,
    title:       "Resurser & Liftar",
    description: "Hantera liftar och arbetsstationer",
  },
  {
    href:        "/installningar/api-nycklar",
    icon:        Key,
    title:       "API-nycklar",
    description: "Skapa och hantera nycklar för onlinebokning",
  },
  {
    href:        "/installningar/kalender-prenumeration",
    icon:        Calendar,
    title:       "Kalenderprenumeration",
    description: "Hämta iCal-länk för din telefonkalender",
  },
  {
    href:        "/installningar/server",
    icon:        Server,
    title:       "Serverstatus",
    description: "Övervaka DATAHUNTER, Redis, databas och serveranslutningar",
  },
];

export default function InstallningarPage() {
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold text-workshop-text">Inställningar</h1>

      <div className="grid gap-3">
        {settingsLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="surface p-4 flex items-center gap-4 hover:bg-workshop-elevated transition-colors"
          >
            <div className="p-2 bg-workshop-elevated rounded-lg">
              <link.icon className="h-5 w-5 text-workshop-accent" />
            </div>
            <div>
              <p className="font-medium text-workshop-text">{link.title}</p>
              <p className="text-sm text-workshop-muted">{link.description}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Auto-start toggle — only visible in Electron */}
      <AutoStartToggle />
    </div>
  );
}
