# 🧾 scaNLand – Lebensmittel-Code Scanner

> Eine mobile App, mit der man **Genusstauglichkeits- oder Identitätskennzeichen** (z. B. `DE BY 12345 EG`) scannen und Informationen über den zugehörigen Herstellerbetrieb abrufen kann.

---

## 🚀 Ziel

Mit **scaNLand** sollen Verbraucher oder Interessierte einfach per Smartphone-Kamera EU-Zulassungsnummern scannen können.  
Die App liest den Code, sucht ihn in einer zentralen Datenbank und zeigt Details wie Name, Adresse und Betrieb des Herstellers an.

---

## 🧱 Architekturüberblick

```text
[Flutter App]
    ↓ (HTTP / REST)
[Backend API - Node.js (Express)]
    ↓
[MariaDB/MySQL Datenbank mit Herstellerdaten]
```

- **Frontend:** Flutter App (Kamera-Scan + Anzeige der Ergebnisse)
- **Backend:** Node.js + Express REST API
- **Datenbank:** MariaDB/MySQL
- **Deployment:** Bestehendes Hosting

---

## 🗺️ Projekt-Roadmap

### 1️⃣ Backend – Datenbasis & API

#### a) Datenbeschaffung

- Quelle: [BVL – Bundesamt für Verbraucherschutz und Lebensmittelsicherheit](http://www.bvl.bund.de/bltu)  
  → Enthält Listen (PDF/Excel) der zugelassenen Lebensmittelbetriebe in Deutschland
- Extrahiere u. a.:
  - `code` (z. B. `DE BY 12345 EG`)
  - `betrieb`
  - `adresse`
  - `bundesland`
  - `land`
  - `kategorie`
  - `quelle`
- Speichere alles in einer CSV → später Import in DB

#### b) Datenbank-Struktur (MySQL/MariaDB)

```sql
CREATE TABLE hersteller (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE,
  name VARCHAR(255),
  adresse VARCHAR(255),
  bundesland VARCHAR(100),
  land VARCHAR(10),
  kategorie VARCHAR(100),
  quelle VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_code ON hersteller(code);
```

#### c) Node.js REST API

- Framework: **Express**
- DB-Client: **mysql2**
- Endpoints:
  - `GET /api/hersteller/:code` → Gibt Hersteller-Infos als JSON zurück
  - `GET /api/ping` → Healthcheck
  - (Optional) `GET /api/search?query=mueller` → Textsuche
- Optional: API-Key-Absicherung

##### Beispiel-Response

```json
GET /api/hersteller/DE-BY-12345-EG
→
{
  "code": "DE BY 12345 EG",
  "name": "Müller Fleisch GmbH",
  "adresse": "Pforzheim",
  "land": "DE",
  "bundesland": "Baden-Württemberg"
}
```

#### d) Deployment

- `.env` Datei:

  ```bash
  DB_HOST=localhost
  DB_USER=dein_user
  DB_PASS=dein_passwort
  DB_NAME=scanland
  PORT=3000
  ```

- Test lokal:

  ```bash
  curl http://localhost:3000/api/hersteller/DE-BY-12345-EG
  ```

---

### 2️⃣ Frontend – Flutter App

#### a) Grundstruktur

- Flutter SDK installieren
- Neues Projekt erstellen:

  ```bash
  flutter create scanland
  ```

- Abhängigkeiten:
  - `mobile_scanner` → Kamera-Scanner
  - `http` → API-Aufrufe
  - `provider` oder `riverpod` → State Management

#### b) Kernfunktionen

1. Kamera öffnet sich → Scan des Codes
2. App sendet REST-Request an Backend
3. Backend gibt JSON mit Herstellerdaten zurück
4. Ergebnis wird angezeigt (Name, Adresse, Betrieb)

#### c) API-Call Beispiel (Flutter)

```dart
final url = Uri.parse("https://deinedomain.de/api/hersteller/$code");
final res = await http.get(url);
final data = jsonDecode(res.body);
```

#### d) UI / Screens

- **ScannerScreen:** Kameraansicht
- **ResultScreen:** Anzeige der Herstellerdaten
- Optional: Offline-Cache oder Favoritenfunktion

---

### 3️⃣ Datenpflege & Updates

- Erstimport: BVL-Daten (Deutschland)
- Regelmäßige Updates (z. B. jährlich)
- Optional:
  - CSV-Import-Tool oder Web-Admin-Oberfläche
  - „Fehlender Betrieb?“–Button in der App (Crowdsourcing)

---

### 4️⃣ Erweiterungen (optional)

- Benutzer-Accounts oder API-Key-Auth
- Logging / Statistiken / Scan-History
- EU-weite Daten (AGES, NVWA, etc.)
- Realtime Features (Websocket oder SSE)
- Admin-Dashboard

---

## 🧠 Tech-Stack Übersicht

| Bereich     | Technologie       | Begründung                                         |
| ----------- | ----------------- | -------------------------------------------------- |
| **App**     | Flutter           | Cross-Platform, gute Kamera-Integration            |
| **Backend** | Node.js + Express | Gleiche Sprache wie im Frontend, leichtgewichtig   |
| **DB**      | MariaDB / MySQL   | Bestehende Infrastruktur, schnell für Leseabfragen |

---

## ⚙️ Setup Quickstart

### 🔸 Backend

```bash
git clone https://github.com/dstN/scaNLand.git
cd backend
npm install
cp .env.example .env
pm2 start api.js
```

### 🔸 Datenbank

```bash
mysql -u user -p dbname < schema.sql
mysqlimport --local --ignore-lines=1 --fields-terminated-by=',' dbname hersteller.csv
```

### 🔸 Flutter-App

```bash
cd flutter_app
flutter pub get
flutter run
```

---

## 📚 Quellen & Lizenz

- Datenquelle: **BVL** – Bundesamt für Verbraucherschutz und Lebensmittelsicherheit
- Wikipedia: [Genusstauglichkeits- und Identitätskennzeichen](https://de.wikipedia.org/wiki/Genusstauglichkeits-_und_Identit%C3%A4tskennzeichen)
- App & API Code: © [dstN](https://github.com/dstN) / [scaNLand](https://github.com/dstN/scaNLand)
- Lizenz: MIT

---

### ✅ TL;DR

> 1️⃣ Backend + Datenbank aufsetzen  
> 2️⃣ API-Endpunkte implementieren  
> 3️⃣ Flutter-App mit Kamera & API-Verbindung bauen  
> 4️⃣ Daten regelmäßig aktualisieren  
> 5️⃣ Optional: Crowdsourcing, Auth, EU-Erweiterung

---

Made with ❤️, Node.js & Flutter by [dstN](https://github.com/dstN)  
👉 [https://github.com/dstN/scaNLand](https://github.com/dstN/scaNLand)
