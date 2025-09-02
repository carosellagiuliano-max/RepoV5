# Admin Appointments Console (Calendar Pro) - Guide

## Übersicht

Das Admin Appointments Console (Calendar Pro) ist eine professionelle Terminverwaltungslösung für Friseursalons mit erweiterten Funktionen wie Drag & Drop, Konfliktprüfung und fortschrittlicher Filterung.

## Hauptfunktionen

### 1. Kalenderansichten
- **Tagesansicht**: Detaillierte Stunden-Slots mit allen Terminen
- **Wochenansicht**: 7-Tage-Übersicht mit Drag & Drop
- **Monatsansicht**: Monatsübersicht für Langzeitplanung

### 2. Drag & Drop Reschedule
- Einfaches Verschieben von Terminen per Drag & Drop
- Automatische Konfliktprüfung in Echtzeit
- Visuelle Feedback bei Konflikten
- Vorschläge für alternative Zeiten

### 3. Erweiterte Filterung
- **Mitarbeiter-Filter**: Nach spezifischen Mitarbeitern filtern
- **Service-Filter**: Nach Dienstleistungen filtern
- **Status-Filter**: Nach Terminstatus filtern (bestätigt, ausstehend, etc.)
- **Zeitraum-Filter**: Flexible Datumsbereiche
- **Textsuche**: Durchsuche Kunden, Notizen, Services

### 4. Live-Statistiken
- Tägliche Terminanzahl und Umsatz
- Wöchentliche und monatliche Trends
- Mitarbeiter-Performance
- Service-Popularität

## Bedienung

### Neuen Termin erstellen
1. Klicken Sie auf "Neuer Termin"
2. Wählen Sie Kunde, Service und Mitarbeiter
3. Setzen Sie Datum und Uhrzeit
4. System prüft automatisch auf Konflikte
5. Speichern Sie den Termin

### Termin verschieben (Drag & Drop)
1. Klicken und halten Sie einen Termin im Kalender
2. Ziehen Sie ihn zu einem neuen Zeitslot
3. System prüft automatisch auf Konflikte
4. Bei Konflikten werden alternative Zeiten vorgeschlagen
5. Bestätigen Sie die Verschiebung

### Termin stornieren
1. Klicken Sie auf das Menü-Icon (⋮) eines Termins
2. Wählen Sie "Stornieren"
3. Geben Sie optional einen Grund an
4. Bestätigen Sie die Stornierung

### Filter anwenden
1. Klicken Sie auf "Filter"
2. Wählen Sie gewünschte Filterkriterien
3. Klicken Sie "Filter anwenden"
4. Verwenden Sie Schnellauswahl für häufige Zeiträume

## Technische Details

### API-Endpoints
- `GET /.netlify/functions/admin/appointments/list` - Termine abrufen mit Filterung
- `POST /.netlify/functions/admin/appointments/check-conflicts` - Konfliktprüfung
- `POST /.netlify/functions/admin/appointments` - Neuen Termin erstellen
- `PUT /.netlify/functions/admin/appointments/:id` - Termin bearbeiten
- `DELETE /.netlify/functions/admin/appointments/:id` - Termin löschen

### Optimistic Updates
Das System verwendet optimistic updates für bessere UX:
- Änderungen werden sofort in der UI angezeigt
- Bei Fehlern wird automatisch zurückgesetzt
- Toast-Nachrichten informieren über Status

### Konfliktprüfung
- Echtzeit-Prüfung bei Terminänderungen
- Berücksichtigt Mitarbeiter-Verfügbarkeit
- Prüft bestehende Termine mit Pufferzeit
- Schlägt alternative Zeiten vor

## Fehlerbehebung

### Häufige Probleme

**Drag & Drop funktioniert nicht**
- Stellen Sie sicher, dass der Browser Drag & Drop unterstützt
- Überprüfen Sie, ob JavaScript aktiviert ist
- Aktualisieren Sie die Seite

**Konflikte werden nicht erkannt**
- Überprüfen Sie die Mitarbeiter-Verfügbarkeit
- Stellen Sie sicher, dass Pufferzeiten konfiguriert sind
- Kontrollieren Sie bestehende Termine

**Filter zeigen keine Ergebnisse**
- Überprüfen Sie die Filterkriterien
- Verwenden Sie "Alle zurücksetzen"
- Stellen Sie sicher, dass Daten vorhanden sind

## Performance-Tipps

### Große Datenmengen
- Verwenden Sie Datums-Filter für bessere Performance
- Beschränken Sie Ergebnisse pro Seite
- Nutzen Sie die Suchfunktion für spezifische Termine

### Browser-Kompatibilität
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Tastenkürzel

- `Strg + N` - Neuer Termin
- `F` - Filter öffnen
- `Esc` - Dialog schließen
- `Tab` - Navigation zwischen Elementen

## Sicherheit

- Alle API-Aufrufe sind JWT-authentifiziert
- Zod-Schemas validieren alle Eingaben
- Rate-Limiting verhindert Missbrauch
- Strukturiertes Logging für Audit-Trails

## Support

Bei Problemen oder Fragen:
1. Überprüfen Sie diese Dokumentation
2. Schauen Sie in die Browser-Konsole für Fehlermeldungen
3. Kontaktieren Sie den Administrator

## Changelog

### Version 1.0.0
- Initiale Implementierung
- Drag & Drop Funktionalität
- Erweiterte Filterung
- Live-Konfliktprüfung
- Optimistic Updates
- Responsive Design