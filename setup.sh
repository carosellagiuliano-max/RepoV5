#!/bin/bash

# Schnittwerk Your Style - Setup Script
# Dieses Script führt dich durch die komplette Einrichtung

set -e

echo "🚀 Schnittwerk Your Style - Vollständige Einrichtung"
echo "=================================================="

# Farben für Ausgabe
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funktion für farbige Ausgabe
print_step() {
    echo -e "${BLUE}[STEP $1]${NC} $2"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Schritt 1: Dependencies prüfen
print_step "1" "Prüfe Dependencies..."
command -v node >/dev/null 2>&1 || { print_error "Node.js ist nicht installiert. Bitte installiere Node.js 18+"; exit 1; }
command -v npm >/dev/null 2>&1 || { print_error "npm ist nicht installiert."; exit 1; }
print_success "Dependencies OK"

# Schritt 2: Supabase CLI prüfen/installieren
print_step "2" "Prüfe Supabase CLI..."
if ! command -v supabase >/dev/null 2>&1; then
    print_warning "Supabase CLI nicht gefunden. Installiere..."
    npm install -g supabase
fi
print_success "Supabase CLI bereit"

# Schritt 3: Projekt-Setup
print_step "3" "Installiere Projekt-Dependencies..."
npm ci
print_success "Dependencies installiert"

# Schritt 4: ENV-Datei
print_step "4" "Prüfe ENV-Konfiguration..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    print_warning "⚠️  .env wurde aus .env.example kopiert. Bitte bearbeite die Werte!"
else
    print_success "ENV-Datei existiert"
fi

echo ""
echo "🎯 Nächste Schritte:"
echo "==================="
echo ""
echo "1. Supabase einrichten:"
echo "   - Gehe zu https://supabase.com"
echo "   - Erstelle ein neues Projekt"
echo "   - Kopiere Project URL und API Keys"
echo ""
echo "2. ENV-Variablen setzen:"
echo "   - Bearbeite .env mit deinen Supabase-Credentials"
echo "   - Füge Stripe, SMTP, etc. Keys hinzu"
echo ""
echo "3. Datenbank migrieren:"
echo "   npm run db:migrate"
echo ""
echo "4. Seed-Daten laden:"
echo "   npm run db:seed"
echo ""
echo "5. Lokal testen:"
echo "   npm run dev"
echo ""
echo "6. Deploy auf Netlify:"
echo "   - Repository mit Netlify verbinden"
echo "   - ENV-Variablen in Netlify setzen"
echo ""
print_success "Setup-Script abgeschlossen!"
echo ""
echo "📚 Für detaillierte Anleitungen siehe docs/setup.md"
