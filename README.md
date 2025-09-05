# Schnittwerk Your Style

Ein vollständiges Hair Salon Booking System mit React Frontend und Supabase Backend.

## 🚀 Schnellstart

### Automatische Einrichtung

```bash
git clone <repository-url>
cd schnittwerk-your-style-34
npm run setup
```

Folge dann der Schritt-für-Schritt Anleitung in `docs/setup.md`.

### Manuelle Einrichtung

```bash
# Dependencies installieren
npm ci

# Entwicklungsserver starten (mit Mocks)
DB_MOCK_MODE=true npm run dev

# Mit echter Datenbank
npm run dev
```

## 📋 Voraussetzungen

- Node.js 18+
- Supabase-Konto (kostenlos)
- Netlify-Konto (kostenlos)
- Stripe-Konto (für Zahlungen)

## 🏗️ Architektur

- **Frontend**: React + TypeScript + Vite + Shadcn/UI
- **Backend**: Netlify Functions + Supabase
- **Datenbank**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth mit RBAC
- **Zahlungen**: Stripe
- **Email**: SMTP (SendGrid/Gmail)
- **Tests**: Playwright E2E-Tests

## 📁 Projekt-Struktur

```
├── src/
│   ├── admin/          # Admin-Panel
│   ├── components/     # UI-Komponenten
│   ├── hooks/          # Custom React Hooks
│   ├── lib/            # Utilities & Supabase Client
│   └── test/           # Unit Tests
├── netlify/functions/  # Serverless Functions
├── tests/e2e/          # E2E-Tests
├── docs/db/            # Datenbank-Schema
└── docs/               # Dokumentation
```

## 🧪 Tests

```bash
# Unit Tests
npm run test

# E2E Tests (mit Mocks)
DB_MOCK_MODE=true npm run test:e2e

# E2E Tests (mit echter DB)
npm run test:e2e
```

## 🚀 Deployment

### Netlify

1. Repository mit Netlify verbinden
2. Build Settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
3. ENV-Variablen setzen (siehe `.env.example`)

### Lokale Entwicklung

```bash
# Mit Supabase Local
npx supabase start
npm run dev

# Mit Cloud Supabase
npm run dev
```

## 📚 Dokumentation

- [Vollständige Einrichtung](docs/setup.md)
- [Testing Guide](docs/testing.md)
- [API Dokumentation](docs/booking-engine-api.md)
- [Security](docs/security-implementation-summary.md)

## 🔧 Verfügbare Scripts

```bash
npm run dev          # Entwicklungsserver
npm run build        # Produktions-Build
npm run preview      # Build-Vorschau
npm run lint         # Code-Linting
npm run test         # Unit Tests
npm run test:e2e     # E2E Tests
npm run db:migrate   # DB Migration
npm run db:seed      # Test-Daten laden
npm run setup        # Vollständige Einrichtung
```

## 🎯 Features

- ✅ Kunden-Buchungssystem
- ✅ Admin-Panel mit CRUD
- ✅ RBAC (Role-Based Access Control)
- ✅ Stripe-Zahlungen
- ✅ Email-Benachrichtigungen
- ✅ PWA-Unterstützung
- ✅ SEO-optimiert
- ✅ Responsive Design
- ✅ Vollständige E2E-Testabdeckung

## 🤝 Beitragen

1. Fork das Repository
2. Erstelle einen Feature-Branch
3. Commit deine Änderungen
4. Push zum Branch
5. Erstelle einen Pull Request

## 📄 Lizenz

Dieses Projekt ist privat und nur für den internen Gebrauch bestimmt.

## 🆘 Support

Bei Problemen:
1. Prüfe `docs/setup.md`
2. Schaue in die Logs: `npm run build`
3. Teste lokal: `npm run dev`
4. Erstelle ein Issue im Repository
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/af61227d-37d6-4d60-be1b-2001fe1ba413) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
