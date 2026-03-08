# Cloudflare Tunnel Setup Guide

Denna guide förklarar hur du exponerar det lokala Verkstads-ERP-systemet säkert via internet
med Cloudflare Tunnel (cloudflared). Detta gör det möjligt att ta emot onlinebokningar från
din verkstads webbplats utan att öppna brandväggsportar.

---

## Förutsättningar

- Gratis Cloudflare-konto på https://cloudflare.com
- En domän hanterad av Cloudflare (t.ex. `dinverkstad.se`)
- Next.js-appen körs lokalt på port 3000
- Windows 10/11 (denna guide) eller Linux/macOS

---

## Steg 1: Installera cloudflared

### Windows (rekommenderat: winget)

```powershell
winget install --id Cloudflare.cloudflared
```

### Alternativ: Manuell installation

1. Ladda ned den senaste versionen från:
   https://github.com/cloudflare/cloudflared/releases/latest
2. Ladda ned `cloudflared-windows-amd64.exe`
3. Döp om filen till `cloudflared.exe`
4. Flytta till `C:\Windows\System32\` (eller lägg till i PATH)

### Verifiera installation

```powershell
cloudflared --version
```

---

## Steg 2: Logga in på Cloudflare

```powershell
cloudflared tunnel login
```

En webbläsare öppnas automatiskt. Logga in och välj din domän.
En certifikatfil sparas automatiskt i `C:\Users\<ditt_namn>\.cloudflared\cert.pem`.

---

## Steg 3: Skapa en tunnel

```powershell
cloudflared tunnel create verkstads-erp
```

Notera det **Tunnel ID** som visas (t.ex. `a1b2c3d4-e5f6-...`).
En credentials-fil skapas automatiskt i `~/.cloudflared/<TUNNEL_ID>.json`.

---

## Steg 4: Konfigurera DNS

```powershell
cloudflared tunnel route dns verkstads-erp boka.dinverkstad.se
```

Detta skapar en CNAME-post i Cloudflare DNS:
`boka.dinverkstad.se → <TUNNEL_ID>.cfargotunnel.com`

Du kan också peka hela subdomänen:
```powershell
cloudflared tunnel route dns verkstads-erp erp.dinverkstad.se
```

---

## Steg 5: Skapa konfigurationsfil

Skapa `C:\Users\<ditt_namn>\.cloudflared\config.yml`:

```yaml
tunnel: <DITT_TUNNEL_ID>
credentials-file: C:\Users\<ditt_namn>\.cloudflared\<TUNNEL_ID>.json

ingress:
  # Bokningssida och API för externa bokningar
  - hostname: boka.dinverkstad.se
    service: http://localhost:3000
    originRequest:
      noTLSVerify: false

  # Valfritt: hela ERP-systemet (kräver VPN eller IP-begränsning i Cloudflare)
  # - hostname: erp.dinverkstad.se
  #   service: http://localhost:3000

  # Catch-all (obligatorisk)
  - service: http_status:404
```

Ersätt `<DITT_TUNNEL_ID>` och `<ditt_namn>` med faktiska värden.

---

## Steg 6: Starta tunneln (test)

```powershell
cloudflared tunnel run verkstads-erp
```

Testa att https://boka.dinverkstad.se fungerar i webbläsaren.

---

## Steg 7: Kör som Windows-tjänst (automatisk start)

```powershell
# Installera som Windows-tjänst (kör som administratör)
cloudflared service install

# Starta tjänsten
Start-Service cloudflared

# Verifiera status
Get-Service cloudflared
```

Tunneln startar nu automatiskt vid Windows-start.

### Hantera tjänsten

```powershell
Stop-Service cloudflared
Start-Service cloudflared
Restart-Service cloudflared

# Avinstallera tjänsten
cloudflared service uninstall
```

---

## Steg 8: Uppdatera miljövariabler

Uppdatera `.env.local` med din tunneldomän:

```bash
NEXT_PUBLIC_API_URL=https://boka.dinverkstad.se
ALLOWED_ORIGINS=https://dinverkstad.se,https://www.dinverkstad.se,https://boka.dinverkstad.se
```

---

## Steg 9: Skapa API-nyckel för webbplatsen

I Supabase Dashboard (eller via SQL), skapa en API-nyckel:

```sql
-- Generera en nyckel manuellt och hash:a den med SHA-256
-- Sedan INSERT i api_keys-tabellen

INSERT INTO api_keys (name, key_hash, key_prefix, allowed_origins, scopes)
VALUES (
  'Verkstadens webbplats',
  '<SHA-256 hash av din nyckel>',
  'wks_abcd',
  ARRAY['https://dinverkstad.se', 'https://www.dinverkstad.se'],
  ARRAY['booking:write']
);
```

Du kan generera och hash:a en nyckel med Node.js:

```javascript
const crypto = require('crypto');
const key = 'wks_' + crypto.randomBytes(20).toString('hex');
const hash = crypto.createHash('sha256').update(key).digest('hex');
console.log('API-nyckel (spara säkert):', key);
console.log('Hash (lägg i databasen):', hash);
console.log('Prefix:', key.slice(0, 12));
```

---

## Steg 10: Embed bokningswidgeten på din webbplats

### Via iframe (enklast)

```html
<iframe
  src="https://boka.dinverkstad.se/boka"
  width="100%"
  height="700"
  frameborder="0"
  style="border-radius: 8px;"
></iframe>
```

### Via direkt API-anrop (avancerat)

```javascript
// Hämta tillgängliga tider
const response = await fetch('https://boka.dinverkstad.se/api/availability?days=14');
const { data } = await response.json();

// Skapa en bokning
const booking = await fetch('https://boka.dinverkstad.se/api/book', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer DIN_API_NYCKEL'
  },
  body: JSON.stringify({
    regNr:         'ABC123',
    customerName:  'Kalle Karlsson',
    customerPhone: '070-123 45 67',
    requestedDate: '2026-03-15',
    requestedTime: '10:00',
    durationMinutes: 60
  })
});
```

---

## Felsökning

### Tunnel ansluter inte
```powershell
# Kontrollera loggar
cloudflared tunnel info verkstads-erp
Get-EventLog -LogName Application -Source cloudflared -Newest 20
```

### 502 Bad Gateway
- Kontrollera att Next.js körs: `npm run dev` eller `npm run start`
- Verifiera att port 3000 är öppen: `netstat -an | findstr 3000`

### CORS-fel från webbplatsen
- Kontrollera att domänen finns i `ALLOWED_ORIGINS`
- Starta om Next.js efter att ha ändrat `.env.local`

### API-nyckel nekad
- Verifiera att nyckeln hash:ades korrekt (SHA-256)
- Kontrollera att `is_active = true` i `api_keys`-tabellen
- Verifiera att `allowed_origins` inkluderar din webbplats-domän

---

## Säkerhet

- Tunneln krypterar all trafik end-to-end via Cloudflare
- Inga portar behöver öppnas i routern/brandväggen
- API-nycklar skyddas via SHA-256 hash (rånyckeln lagras aldrig)
- CORS begränsar vilka domäner som kan anropa boknings-API:et
- Alla externa förfrågningar loggas i `booking_request_log`

---

## Nütziga kommandon

```powershell
# Visa alla tunnlar
cloudflared tunnel list

# Visa tunnel-statistik
cloudflared tunnel info verkstads-erp

# Ta bort tunnel (permanent)
cloudflared tunnel delete verkstads-erp

# Uppdatera cloudflared
winget upgrade Cloudflare.cloudflared
```
