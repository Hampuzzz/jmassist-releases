# Verkstads-ERP

Fullstack ERP-system för bilverkstäder, inspirerat av Winassist.
Byggt med Next.js 14, Supabase (PostgreSQL), Tailwind CSS och Drizzle ORM.

---

## Funktioner

| Modul               | Funktioner                                                                 |
|---------------------|---------------------------------------------------------------------------|
| **Arbetsorder**     | Kanban-vy, statustransitioner, mekaniktilldelning, inspektionschecklista  |
| **Vagnkort**        | Fordonsregister, Bilvision API-integration (regnr-sökning), servicehistorik |
| **Kunder**          | CRM för privat- och företagskunder, länkade fordon                        |
| **Lager**           | Artikelhantering, lagernivåer, pålägg, BilXtra-integration (placeholder)  |
| **Faktura / Offert**| Offerter och fakturor, VAT/VMB-beräkning, PDF-export (förberett)          |
| **Kalender**        | Veckovy per resurs/lyft, dubbelbokningsskydd, drag-and-drop (WIP)         |
| **Onlinebokning**   | Publik bokningssida, automatisk tidstilldelning, embeddable widget         |
| **iCal-export**     | Prenumerera på verkstadens kalender i Google/Apple/Outlook                |
| **API-åtkomst**     | API-nycklar, CORS-kontroll, inloggningslogg för externa förfrågningar      |

---

## Snabbstart

### Förutsättningar

- Node.js 18+
- Supabase CLI: `npm install -g supabase`
- Git

### 1. Klona och installera

```bash
cd G:\ADOFF
npm install
```

### 2. Konfigurera miljövariabler

```bash
copy .env.example .env.local
# Redigera .env.local med dina värden
```

### 3. Starta Supabase lokalt

```bash
supabase init
supabase start
```

Anteckna URL och anon key från utdata och uppdatera `.env.local`.

### 4. Kör databas-migrationer

```bash
supabase db reset
# eller manuellt:
supabase db push
```

Migrationerna körs i ordning:
- `0001_initial_schema.sql` – Alla tabeller, enum, index, triggers
- `0002_rls_policies.sql` – Row Level Security
- `0003_functions_triggers.sql` – Funktioner och triggers
- `0004_seed_data.sql` – Standardöppettider, 4 liftar, inspektionsmall

### 5. Starta utvecklingsservern

```bash
npm run dev
```

Öppna http://localhost:3000

---

## Projektstruktur

```
src/
├── app/
│   ├── (auth)/login/          # Inloggningssida
│   ├── (dashboard)/           # Alla inloggade sidor
│   │   ├── dashboard/         # Översikt / KPI
│   │   ├── arbetsorder/       # Arbetsorderhantering
│   │   ├── kalender/          # Veckokalender
│   │   ├── vagnkort/          # Fordonsdatabas
│   │   ├── kunder/            # Kundregister
│   │   ├── lager/             # Lagerhantering
│   │   ├── faktura/           # Faktura & Offert
│   │   ├── boka/              # Publik bokningssida
│   │   └── installningar/     # Inställningar
│   └── api/
│       ├── arbetsorder/       # Work order API
│       ├── vagnkort/          # Vehicle API
│       ├── kunder/            # Customer API
│       ├── lager/             # Inventory API
│       ├── faktura/           # Invoice API
│       ├── kalender/          # Calendar API + iCal
│       ├── resurser/          # Resources API
│       ├── availability/      # Public availability API
│       ├── book/              # Public booking API
│       └── integrationer/     # External integrations
├── components/
│   ├── layout/                # Sidebar, Header
│   └── kalender/              # BookingWidget
├── lib/
│   ├── db/schemas/            # Drizzle ORM schemas
│   ├── supabase/              # Supabase clients
│   ├── scheduling/            # Availability, iCal, conflicts
│   ├── middleware/            # CORS, API-key, logger
│   ├── integrations/          # Bilvision, BilXtra
│   ├── calculations/          # VAT, VMB
│   └── validations/           # Zod schemas
└── middleware.ts              # Next.js auth middleware
```

---

## API-dokumentation

### Publika endpoints (ingen Supabase-session krävs)

| Metod  | Endpoint           | Beskrivning                              |
|--------|--------------------|------------------------------------------|
| GET    | `/api/availability`| Lediga tider de närmaste 30 dagarna      |
| POST   | `/api/book`        | Skapa bokning (kräver API-nyckel)        |
| GET    | `/api/kalender/ical?token=<jwt>` | iCal-feed för kalenderapp |

### Interna endpoints (kräver Supabase-session)

```
GET/POST    /api/arbetsorder
GET/PATCH   /api/arbetsorder/[id]
PATCH       /api/arbetsorder/[id]/status
GET/POST    /api/kalender
GET/PATCH   /api/kalender/[id]
GET         /api/kalender/ical             (returnerar prenumerations-URL)
GET/POST    /api/resurser
GET/POST    /api/vagnkort
GET         /api/vagnkort/sok?reg_nr=
GET/POST    /api/kunder
GET/POST    /api/lager
GET/POST    /api/faktura
GET         /api/integrationer/bilvision?reg_nr=
```

---

## Onlinebokning och Cloudflare Tunnel

Se [CLOUDFLARE_TUNNEL.md](./CLOUDFLARE_TUNNEL.md) för fullständiga instruktioner.

### Snabbversion

```bash
# Installera cloudflared
winget install --id Cloudflare.cloudflared

# Logga in
cloudflared tunnel login

# Skapa tunnel
cloudflared tunnel create verkstads-erp

# Kör
cloudflared tunnel run verkstads-erp
```

### Embed bokningswidgeten

```html
<iframe
  src="https://boka.dinverkstad.se/boka"
  width="100%"
  height="700"
  frameborder="0">
</iframe>
```

---

## Databasschema

Scheman finns i `supabase/migrations/`. Nyckelrelationer:

```
customers ──< vehicles ──< work_orders ──< work_order_parts >── parts
                              |
                         appointments ──> resources
                              |
                           invoices ──< invoice_lines
```

### VMB (Vinstmarginalbeskattning)

För begagnade delar/fordon: `vmb_eligible = TRUE` på fakturarader.
Momsen beräknas som `(säljpris - inköpspris) × 0.20` (= 25% på marginalen).
Se `src/lib/calculations/vat.ts` för logiken.

---

## Konfiguration

### Miljövariabler

| Variabel                    | Beskrivning                              |
|-----------------------------|------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`  | Supabase-projektets URL                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon-nyckel                 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role-nyckel             |
| `DATABASE_URL`              | PostgreSQL anslutningssträng (Drizzle)   |
| `BILVISION_API_KEY`         | Lämna tomt för mock-data (dev)          |
| `ALLOWED_ORIGINS`           | Kommaseparerade tillåtna CORS-domäner    |
| `ICAL_SECRET`               | Slumpmässig sträng för iCal-token       |
| `WORKSHOP_HOURLY_RATE`      | Standardtimpris i SEK                    |

---

## Licens

Privat projekt. Ej för distribution.
