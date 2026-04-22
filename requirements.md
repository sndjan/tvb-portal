# Requirements: Tennisverein Arbeitseinsätze Web App

## 1. Ziel

Ziel der Anwendung ist die einfache Verwaltung und Anzeige von Arbeitseinsätzen für einen Tennisverein.
Mitglieder sollen Einsätze einsehen und sich eintragen können.
Ein Admin (Platzwart) verwaltet alle Inhalte.

---

## 2. Rollen & Rechte

### Admin

- Authentifizierung über globales Passwort
- Session-basiert eingeloggt
- Logout-Funktion vorhanden
- Darf:
  - Arbeitseinsätze erstellen
  - bearbeiten
  - löschen
  - sichtbar/versteckt setzen
  - Status ändern (offen / erledigt)
  - Teilnehmer einsehen
  - E-Mails versenden

### Viewer (öffentliche Nutzer)

- Kein Login erforderlich
- Darf:
  - [x] Arbeitseinsätze einsehen
  - sich für Einsätze eintragen
  - eigene Eintragung löschen (über LocalStorage)

---

## 3. Arbeitseinsätze

### Attribute eines Arbeitseinsatzes

- Titel (Pflicht)
- Beschreibung (Pflicht)
- Startdatum (optional)
- Enddatum (optional)
- Geschätzte Dauer (optional)
- Benötigte Personen (optional)
- Bilder (optional, mehrere möglich)
- Status:
  - offen
  - erledigt

- Sichtbarkeit:
  - sichtbar
  - versteckt (nur Admin sieht es)

---

## 4. Teilnehmer

### Funktionalität

- Nutzer tragen nur ihren **Namen** ein
- Keine E-Mail erforderlich
- Pro Einsatz nur **eine Eintragung pro Nutzer**
- Speicherung im Backend:
  - Name
  - Timestamp (Zeitpunkt der Eintragung)

- Nutzer können ihre Eintragung löschen (Client-seitig via LocalStorage gesteuert)

### Anzeige

- Admin:
  - sieht Liste aller Teilnehmer (Namen)

- Viewer:
  - sieht nur Anzahl der Teilnehmer

---

## 5. Status & Struktur

### Tabs

- Offen
- Erledigt (Archiv)

### Verhalten

- Status wird manuell durch Admin gesetzt
- Keine automatische Archivierung
- Archivierte Einträge können wieder aktiviert werden

---

## 6. Sichtbarkeit

- Versteckte Einsätze:
  - [x] nur für Admin sichtbar
  - [x] komplett unsichtbar für Viewer

---

## 7. Upload (Bilder)

### Anforderungen

- Mehrere Bilder pro Einsatz möglich
- Vorschau vor Upload
- Bilder können gelöscht werden
- Keine Reihenfolge notwendig
- Speicherung über Storage (z. B. Supabase Storage)

---

## 8. UI / UX

### Allgemein

- Mobile-first
- Funktioniert auch auf Desktop (wichtig für Admin)
- Sehr simples Design
- Keine Mehrsprachigkeit
- Basis-Accessibility

### Darstellung

- Liste von Arbeitseinsätzen
- Alle Informationen direkt sichtbar (keine Detailseite)
- Keine Filter
- Keine Suche
- Keine Sortierung (Reihenfolge = Erstellungsreihenfolge)

### Komponenten

- Liste von Einsätzen
- Button für Admin: "Neuen Einsatz erstellen"
- Modal/Dialog zum Erstellen/Bearbeiten

### Sonderfälle

- Keine Einsätze:
  - [x] Anzeige: „Aktuell keine Arbeitseinsätze“

- Ladezustände:
  - Skeleton Loader

- Fehler:
  - [x] Allgemeine Fehlermeldung bei Backend-Problemen

---

## 9. Kalender-Integration

- Button zum Download einer `.ics` Datei
- Nur sichtbar, wenn:
  - Startdatum UND Enddatum gesetzt sind

---

## 10. E-Mail-System (Version 3)

### Verhalten

- Optional beim Erstellen eines Einsatzes:
  - Checkbox „E-Mail senden“

- Wenn aktiviert:
  - Versand an alle E-Mail-Adressen aus Verteilerliste

### Inhalt der E-Mail

- Titel
- Beschreibung
- Datum
- Link zur Webseite / zum Einsatz

### Technische Optionen

- Backend-Funktion (z. B. Supabase Functions) oder externer Dienst
- Fehler beim Versand:
  - Anzeige für Admin

---

## 11. Datenmodell (High-Level)

### Tabellen

#### `tasks` (Arbeitseinsätze)

- id
- title
- description
- start_date
- end_date
- duration_estimate
- required_people
- status (open / done)
- is_hidden (boolean)
- created_at

#### `participants`

- id
- task_id (FK)
- name
- created_at

#### `images`

- id
- task_id (FK)
- url
- created_at

#### `email_list`

- id
- email

---

## 12. Authentifizierung

- Einfaches Passwort-System
- Speicherung:
  - entweder ENV Variable oder Backend

- Session-basiert
- Logout möglich
- Kein Rate Limiting im MVP

---

## 13. Fehlerhandling

- Backend nicht erreichbar:
  - [x] Fehlermeldung anzeigen

- E-Mail-Versand fehlgeschlagen:
  - Admin bekommt Feedback

- Loading States:
  - Skeleton Loader

---

## 14. Deployment

- Hosting
- Nutzung von Environment Variablen
- Speicherung sensibler Daten (Passwort, API Keys)

---

## 15. Versionierung / Roadmap

### Version 1 (MVP)

- UI für Liste von Arbeitseinsätzen
- Anzeige von Daten (auch Mock-Daten möglich)
- Grundlegende Struktur

### Version 2

- Admin kann Einsätze erstellen/bearbeiten/löschen
- Teilnehmer können sich eintragen
- Speicherung im Backend
- Authentifizierung für Admin

### Version 3

- E-Mail-Versand bei neuen Einsätzen
- Integration Verteilerliste

---

## 16. Nicht im Scope (aktuell)

- Filter / Suche
- Kategorien
- Statistiken
- Gamification
- QR-Code Features
- Reminder
- CI/CD Pipeline
- Erweiterte Security
- Mehrsprachigkeit
- Erweiterte Accessibility
- Impressum / Datenschutz (vorerst)

---
