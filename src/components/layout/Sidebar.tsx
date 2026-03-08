"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Wrench, Car, Users, Package, FileText, Calendar,
  LayoutDashboard, Settings, ChevronRight, TrendingUp, MessageSquare, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href:  "/dashboard",
    icon:  LayoutDashboard,
    label: "Översikt",
  },
  {
    href:  "/arbetsorder",
    icon:  Wrench,
    label: "Arbetsorder",
  },
  {
    href:  "/kalender",
    icon:  Calendar,
    label: "Kalender",
  },
  {
    href:  "/vagnkort",
    icon:  Car,
    label: "Vagnkort",
  },
  {
    href:  "/kunder",
    icon:  Users,
    label: "Kunder",
  },
  {
    href:  "/lager",
    icon:  Package,
    label: "Lager",
  },
  {
    href:  "/faktura",
    icon:  FileText,
    label: "Faktura",
  },
  {
    href:  "/ekonomi",
    icon:  TrendingUp,
    label: "Ekonomi",
  },
  {
    href:  "/crm",
    icon:  MessageSquare,
    label: "CRM",
  },
  {
    href:  "/meddelanden",
    icon:  Send,
    label: "Meddelanden",
  },
  {
    href:  "/installningar",
    icon:  Settings,
    label: "Inställningar",
    bottom: true,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  const topItems = navItems.filter((i) => !i.bottom);
  const bottomItems = navItems.filter((i) => i.bottom);

  return (
    <aside className="w-16 md:w-56 flex flex-col bg-workshop-surface border-r border-workshop-border flex-shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center justify-center md:justify-start px-4 border-b border-workshop-border">
        <Wrench className="h-6 w-6 text-workshop-accent flex-shrink-0" />
        <span className="hidden md:block ml-2 font-bold text-workshop-text text-sm">
          JM Assist
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 flex flex-col gap-1 px-2">
        {topItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors group",
                "min-h-[44px]",
                isActive
                  ? "bg-workshop-accent/20 text-workshop-accent"
                  : "text-workshop-muted hover:bg-workshop-elevated hover:text-workshop-text",
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 flex-shrink-0",
                  isActive ? "text-workshop-accent" : "text-workshop-muted group-hover:text-workshop-text",
                )}
              />
              <span className="hidden md:block text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom items */}
      <div className="py-4 px-2 border-t border-workshop-border space-y-1">
        {bottomItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors group min-h-[44px]",
                isActive
                  ? "bg-workshop-accent/20 text-workshop-accent"
                  : "text-workshop-muted hover:bg-workshop-elevated hover:text-workshop-text",
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span className="hidden md:block text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
        <div className="hidden md:block px-3 pt-2 text-xs text-workshop-muted/50">
          v{process.env.NEXT_PUBLIC_APP_VERSION ?? "1.8.1"}
        </div>
      </div>
    </aside>
  );
}
