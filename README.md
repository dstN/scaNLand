# scaNLand

> Offline-first mobile scanner for EU food approval marks

scaNLand scans EU food approval identification marks printed on food packaging using your smartphone camera, identifies the manufacturer from an embedded database of ~16,000 German approval entries, and works entirely offline.

## What It Does

- **Scan** EU food approval marks via camera OCR (e.g., `DE BY 12345 EG`, `FR 12.345 CE`)
- **Identify** the manufacturer, address, and approval details instantly — **no internet required**
- **Submit** unrecognized codes for community review when a match isn't found
- **Manage** submissions through a secure admin dashboard with fraud detection

## Tech Stack

| Component       | Technology                                                    |
| --------------- | ------------------------------------------------------------- |
| Mobile App      | Ionic 8 + Vue 3 + Capacitor 8                                 |
| Admin Dashboard | Vue 3 SPA                                                     |
| API Server      | Fastify 5 + Drizzle ORM                                       |
| Mobile Database | SQLite @capacitor-community/sqlite + sql.js                   |
| Server Database | SQLite better-sqlite3 (embedded, zero-config)                 |
| OCR Engine      | @jcesarmobile/capacitor-ocr (primary) / Tesseract.js (backup) |
| ETL Pipeline    | Python 3.11+                                                  |
| Monorepo        | Turborepo + npm workspaces                                    |

## Project Structure

```bash
scaNLand/
├── apps/mobile/         # Ionic + Vue 3 mobile app
├── apps/admin/          # Vue 3 admin dashboard
├── packages/shared/     # Shared types, validators, constants
├── server/              # Fastify API server
├── etl/                 # Python ETL pipeline (BVL data → SQLite)
├── sampledata/          # BVL source data (XML + CSV)
├── scripts/             # Build and release scripts
└── .github/workflows/   # CI/CD pipelines
```

## Prerequisites

- **Node.js** 20+
- **Python** 3.11+
- **npm** 10+
- **Android Studio** (for Android builds)
- **Xcode** (for iOS builds, macOS only)

## Getting Started

### 1. Install Dependencies

```bash
# Install all workspace dependencies
npm install

# Install Python ETL dependencies
cd etl && pip install -r requirements.txt && cd ..
```

### 2. Build the Database

```bash
# Run ETL pipeline to generate SQLite DB from BVL data
python etl/src/pipeline.py --source sampledata/ --output apps/mobile/src/assets/db/scanland.db
```

### 3. Run the Mobile App (Development)

```bash
# Start the Ionic dev server
cd apps/mobile
npm run dev
```

### 4. Run on Device

```bash
# Sync web assets to native project
npx cap sync

# Open in Android Studio
npx cap open android

# Or open in Xcode (macOS)
npx cap open ios
```

### 5. Run the Admin Dashboard

```bash
# Start admin dev server
cd apps/admin
npm run dev
```

### 6. Run the API Server & Admin Dashboard

The server uses an embedded SQLite database — **no external database server needed**.

```bash
# 1. Set up the database (creates tables + seeds admin user)
npm run setup:backend

# 2. Start the Fastify API server (port 3000)
cd server
npm run dev
```

**Testing the Admin Dashboard:**

1. Open a new terminal and run `cd apps/admin && npm run dev`
2. Open `http://localhost:5174` in your browser
3. Login with the default credentials:
   - **Email:** `admin@scanland.app`
   - **Password:** `password123`

## Available Scripts

| Script                | Description                                    |
| --------------------- | ---------------------------------------------- |
| `npm run dev`         | Start all apps in development mode (turborepo) |
| `npm run build`       | Build all packages and apps                    |
| `npm run lint`        | Lint all packages                              |
| `npm run test`        | Run all tests                                  |
| `scripts/build-db.sh` | Run ETL + copy DB to mobile assets             |
| `scripts/release.sh`  | Version bump + tag for release                 |

## Database

The app embeds a pre-built SQLite database containing German food approval entries from the BVL (Bundesamt für Verbraucherschutz und Lebensmittelsicherheit). The Python ETL pipeline parses official BVL XML and CSV exports, normalizes approval codes, and produces the SQLite file.

Updates are rare (last official BVL update: 2023). When new data is available, rebuild the DB and release an app update.

## Supported Approval Mark Formats

| Format           | Country | EU Suffix |
| ---------------- | ------- | --------- |
| `DE BY 12345 EG` | Germany | EG        |
| `DE NW 50264 EG` | Germany | EG        |
| `FR 12.345 CE`   | France  | CE        |
| `PL 123456 WE`   | Poland  | WE        |
| `IT 1234 CE`     | Italy   | CE        |

**Recognized EU suffixes:** EG, EC, CE, WE, EF, EY — all normalized to canonical form for lookup.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full architecture document including:

- System architecture diagram
- SQLite schema design
- OCR pipeline and preprocessing
- Code normalization engine
- Fuzzy matching strategy
- Admin moderation workflow
- Security model
- Deployment workflow
- Future EU scaling strategy

## License

Private — All rights reserved.
