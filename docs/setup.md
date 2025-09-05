# Schnittwerk Your Style - Vollständige Einrichtung

## Übersicht

Dieser Leitfaden führt dich Schritt für Schritt durch die komplette Einrichtung des Projekts mit allen Services (Supabase, Netlify, Stripe, Email, etc.).

## Voraussetzungen

- Node.js 18+
- npm oder yarn
- Git
- Ein Webbrowser

## Schritt 1: Projekt klonen und Setup starten

```bash
git clone https://github.com/BeautifyProV5/schnittwerk-your-style-34.git
cd schnittwerk-your-style-34
npm run setup
```

Das Setup-Script prüft alle Dependencies und erstellt die `.env`-Datei.

## Schritt 2: Supabase einrichten

### 2.1 Supabase-Projekt erstellen

1. Gehe zu [supabase.com](https://supabase.com)
2. Erstelle ein kostenloses Konto
3. Klicke "New Project"
4. Wähle:
   - **Name**: `schnittwerk-your-style`
   - **Database Password**: Wähle ein sicheres Passwort
   - **Region**: Frankfurt (EU Central) oder nahe Region

### 2.2 API-Keys kopieren

Nach der Erstellung des Projekts:

1. Gehe zu **Settings** → **API**
2. Kopiere:
   - **Project URL**
   - **anon/public Key**
   - **service_role Key** (geheim halten!)

### 2.3 ENV-Variablen setzen

Bearbeite die `.env`-Datei:

```bash
# Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2.4 Datenbank migrieren

```bash
npm run db:migrate
```

Dies führt alle SQL-Migrationen aus `docs/db/` aus.

### 2.5 Test-Daten laden

```bash
npm run db:seed
```

Dies erstellt Test-User und -Daten.

## Schritt 3: Stripe einrichten (Zahlungen)

### 3.1 Stripe-Konto erstellen

1. Gehe zu [stripe.com](https://stripe.com)
2. Erstelle ein Konto
3. Aktiviere Test-Mode

### 3.2 API-Keys holen

1. Gehe zu **Developers** → **API keys**
2. Kopiere:
   - **Publishable key** (pk_test_...)
   - **Secret key** (sk_test_...)

### 3.3 Webhook einrichten

1. Gehe zu **Developers** → **Webhooks**
2. **Add endpoint**: `https://your-netlify-site.netlify.app/.netlify/functions/webhooks/stripe`
3. Wähle Events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`

### 3.4 ENV-Variablen

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Schritt 4: Email einrichten (SMTP)

### Option 1: SendGrid (empfohlen)

1. Gehe zu [sendgrid.com](https://sendgrid.com)
2. Erstelle Konto
3. Gehe zu **Settings** → **API Keys**
4. Erstelle einen API Key

```bash
# SendGrid
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=SG.xxxxx
```

### Option 2: Gmail

```bash
# Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

## Schritt 5: Netlify einrichten

### 5.1 Repository verbinden

1. Gehe zu [netlify.com](https://netlify.com)
2. **Add new site** → **Import an existing project**
3. Verbinde dein GitHub-Repository
4. **Build command**: `npm run build`
5. **Publish directory**: `dist`

### 5.2 ENV-Variablen setzen

In Netlify Dashboard:

1. Gehe zu **Site settings** → **Environment variables**
2. Füge alle Variablen aus deiner `.env` hinzu
3. **Deploy** die Seite

### 5.3 Domain einrichten (optional)

1. Gehe zu **Domain management**
2. Füge deine Custom Domain hinzu
3. Aktualisiere `VITE_SITE_URL` in ENV

## Schritt 6: Lokale Entwicklung

### 6.1 Server starten

```bash
npm run dev
```

### 6.2 Mit echter DB testen

```bash
# Stelle sicher, dass .env gesetzt ist
npm run dev
```

### 6.3 E2E-Tests laufen lassen

```bash
# Mit echter DB
npm run test:e2e

# Mit Mocks (schneller)
DB_MOCK_MODE=true npm run test:e2e
```

## Schritt 7: Produktions-Deployment

### 7.1 Netlify Deploy

Nach dem Push zu GitHub deployt Netlify automatisch.

### 7.2 Finale Prüfung

1. **Funktionalität testen**:
   - Kundenseite: Buchungen, Services anzeigen
   - Admin-Panel: Login, CRUD-Operationen
   - API-Endpoints: `/api/health`, `/api/webhooks/stripe`

2. **Security prüfen**:
   - HTTPS aktiv
   - Security-Header gesetzt
   - CORS konfiguriert

3. **Performance testen**:
   - Lighthouse Score > 90
   - Core Web Vitals grün

## Troubleshooting

### Supabase-Verbindung fehlt
```bash
# Status prüfen
npx supabase status

# Logs anzeigen
npx supabase logs
```

### Migration-Fehler
```bash
# Reset und neu migrieren
npm run db:reset
```

### Netlify Build fehlt
- Prüfe Build-Logs in Netlify Dashboard
- Stelle sicher, dass alle ENV-Variablen gesetzt sind

### Stripe Webhooks nicht funktionieren
- Prüfe Webhook-URL in Stripe Dashboard
- Stelle sicher, dass Netlify Functions deployed sind

## Support

Bei Problemen:
1. Prüfe die Logs: `npm run build && npm run preview`
2. Teste lokal: `npm run dev`
3. Prüfe ENV-Variablen
4. Schaue in `docs/testing.md` für Test-Anleitungen

## Nächste Schritte

Nach der Einrichtung:
- ✅ Lokal testen
- ✅ E2E-Tests laufen lassen
- ✅ Produktions-Deployment
- ✅ Monitoring einrichten (siehe `docs/monitoring.md`)

Viel Erfolg mit deinem Hair Salon Booking System! 🎉
