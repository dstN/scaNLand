# scaNLand — Architecture Document

> Offline-First EU Food Approval Mark Scanner
> Version 1.0 — March 2026

---

## 1. Overview

scaNLand is a mobile application that scans EU food approval marks (identification stamps on food packaging) using on-device OCR and performs instant offline lookups against an embedded database of ~16,000 German manufacturer entries sourced from the official BVL (Bundesamt für Verbraucherschutz und Lebensmittelsicherheit) dataset.

**Supported approval mark formats:**

```text
DE BY 12345 EG     (German format)
FR 12.345 CE       (French format)
PL 123456 WE       (Polish format)
```

**EU suffix variants recognized:** `EG`, `EC`, `CE`, `WE`, `EF`, `EY`

---

## 2. Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        scaNLand Monorepo                           │
├─────────────────────────┬───────────────────────────────────────────┤
│                         │                                           │
│  ┌───────────────────┐  │  ┌──────────────────┐  ┌──────────────┐  │
│  │   Mobile App      │  │  │  Admin Dashboard  │  │   API Server │  │
│  │  (Ionic 8 + Vue 3 │  │  │   (Vue 3 SPA)    │  │   (Fastify)  │  │
│  │  + Capacitor 8)   │  │  │                  │  │              │  │
│  │                   │  │  │  ┌────────────┐  │  │  ┌────────┐  │  │
│  │  ┌─────────────┐  │  │  │  │ Login      │  │  │  │ Auth   │  │  │
│  │  │ Scanner     │  │  │  │  │ Dashboard  │  │  │  │ RBAC   │  │  │
│  │  │ (OCR via    │  │  │  │  │ Queues     │  │  │  │ Routes │  │  │
│  │  │  @jcesarmo) │  │  │  │  │ Review     │  │  │  │ Upload │  │  │
│  │  └──────┬──────┘  │  │  │  └─────┬──────┘  │  │  └───┬────┘  │  │
│  │         │         │  │  │        │         │  │      │       │  │
│  │  ┌──────▼──────┐  │  │  │        └─────────┼──┼──────┘       │  │
│  │  │ Normalizer  │  │  │  │                  │  │              │  │
│  │  │ + Matcher   │  │  │  └──────────────────┘  └──────┬───────┘  │
│  │  └──────┬──────┘  │  │                               │          │
│  │         │         │  │                        ┌──────▼───────┐  │
│  │  ┌──────▼──────┐  │  │                        │   SQLite DB  │  │
│  │  │  SQLite DB  │  │  │                        │  (server)    │  │
│  │  │ (embedded)  │  │  │                        └──────────────┘  │
│  │  └─────────────┘  │  │                                          │
│  │  ┌─────────────┐  │  │       ┌───────────────────────────┐     │
│  │  │ Submission  │──┼──┼──────►│  Submission API (online)  │     │
│  │  │ Queue       │  │  │       └───────────────────────────┘     │
│  │  └─────────────┘  │  │                                          │
│  └───────────────────┘  │  ┌──────────────────────────────────┐   │
│                         │  │     Python ETL Pipeline          │   │
│  ┌───────────────────┐  │  │  BVL XML/CSV → Normalize →      │   │
│  │  packages/shared  │  │  │  SQLite DB → Mobile Assets      │   │
│  │  Types, Validators│  │  └──────────────────────────────────┘   │
│  │  Constants        │  │                                          │
│  └───────────────────┘  │                                          │
└─────────────────────────┴───────────────────────────────────────────┘
```

---

## 3. Technology Stack

| Layer              | Technology                                        | Version   |
| ------------------ | ------------------------------------------------- | --------- |
| Mobile Framework   | Ionic Framework                                   | 8.x       |
| Mobile UI          | Vue 3 (Composition API + `<script setup>`)        | 3.5+      |
| Native Runtime     | Capacitor                                         | 8.x       |
| State Management   | Pinia                                             | 2.x       |
| Mobile DB          | SQLite via `@capacitor-community/sqlite` + sql.js | 8.x / 1.x |
| Camera Preview     | @capacitor-community/camera-preview               | 8.x       |
| OCR Primary        | @jcesarmobile/capacitor-ocr                       | 0.3.x     |
| OCR Fallback       | Tesseract.js (WASM)                               | 5.x       |
| Admin Dashboard    | Vue 3 SPA (Vite)                                  | 3.5+      |
| Build Tool (Vite)  | Vite                                              | 8.x       |
| API Server         | Fastify                                           | 5.x       |
| Server DB          | SQLite via better-sqlite3                         | 11.x      |
| ORM                | Drizzle ORM                                       | 0.38.x    |
| API Documentation  | OpenAPI 3.1 via `@fastify/swagger`                | 9.4.x     |
| Password Hashing   | Argon2                                            | 0.41.x    |
| JWT Authentication | @fastify/jwt                                      | 9.x       |
| ETL Pipeline       | Python 3.11+                                      | —         |
| Monorepo           | Turborepo + npm workspaces                        | —         |
| CI/CD              | GitHub Actions                                    | —         |

---

## 4. Framework Decision: Vue 3 Everywhere

**Decision:** Use Vue 3 with Composition API for both the mobile app (`@ionic/vue`) and the admin dashboard.

**Rationale:**

- **Single framework** across the monorepo — one mental model, shared composables, unified code review
- `@ionic/vue` is a first-class Ionic integration, production-ready since Ionic 6
- Vue Composition API composables (`useOcr`, `useDatabase`, `useNormalizer`) provide clean service-like abstractions without Angular's DI boilerplate
- Pinia stores are identical across both apps
- `packages/shared` validators and types are consumed identically by both apps
- Smaller bundle than Angular — important for mobile performance
- Vue's reactivity system (`ref`/`computed`/`watch`) maps naturally to OCR state transitions

---

## 5. Dataset Update Strategy

**Decision:** Option A — Embedded SQLite + App Store Release

**Rationale:**

- BVL data updates are extremely rare (last official update: 2023)
- ~16,000 records produce a SQLite file **< 2 MB** — negligible app bundle impact
- Guarantees true offline-first: **zero network dependency** for lookups
- Eliminates hosting costs and complexity for a sync server
- App store update mechanism handles distribution natively
- Avoids delta-sync complexity, versioning conflicts, and partial-update edge cases

**Trade-off accepted:** Users must update the app for new data. Given the update frequency (quarterly at most), this is acceptable.

**Update workflow:**

```text
BVL publishes new data (rare)
  → Python ETL rebuilds scanland.db
  → DB copied to apps/mobile/src/assets/db/
  → Version bump + git tag
  → GitHub Actions builds native apps
  → Submit to App Store / Google Play
```

---

## 6. SQLite Schema

```sql
-- ============================================================
-- Core lookup table: optimized for fast approval code search
-- ============================================================
CREATE TABLE manufacturers (
  id                      INTEGER PRIMARY KEY,
  state_code              TEXT NOT NULL,       -- 'NW', 'BY', 'RP', etc.
  approval_number         TEXT NOT NULL,       -- '50264' (zero-padded)
  normalized_code         TEXT NOT NULL,       -- 'NW50264' (no spaces/dots)
  full_code               TEXT NOT NULL,       -- 'NW 50264' (display format)
  company_name            TEXT NOT NULL,
  street                  TEXT,
  house_number            TEXT,
  postal_code             TEXT,
  city                    TEXT,
  categories              TEXT,                -- JSON array
  restrictions            TEXT,
  remarks                 TEXT,
  third_country_approvals TEXT,
  approval_valid_until    TEXT,
  approval_suspended_since TEXT,
  created_at              TEXT DEFAULT (datetime('now')),
  updated_at              TEXT DEFAULT (datetime('now'))
);

-- Primary search: O(1) exact lookup
CREATE UNIQUE INDEX idx_normalized_code ON manufacturers(normalized_code);
-- Fuzzy: number-only search
CREATE INDEX idx_approval_number ON manufacturers(approval_number);
-- State filter
CREATE INDEX idx_state_code ON manufacturers(state_code);

-- Full-text search for company/city lookup
CREATE VIRTUAL TABLE manufacturers_fts USING fts5(
  company_name, city, normalized_code,
  content='manufacturers', content_rowid='id'
);

-- ============================================================
-- Offline submission queue (synced when online)
-- ============================================================
CREATE TABLE submission_queue (
  id                 INTEGER PRIMARY KEY,
  approval_code      TEXT NOT NULL,
  product_image_path TEXT,
  brand_name         TEXT,
  product_name       TEXT,
  company_name       TEXT,
  address            TEXT,
  country            TEXT,
  region             TEXT,
  category           TEXT,
  ocr_confidence     REAL,
  status             TEXT DEFAULT 'pending',  -- pending|uploading|uploaded|failed
  created_at         TEXT DEFAULT (datetime('now')),
  retry_count        INTEGER DEFAULT 0,
  last_error         TEXT
);

-- ============================================================
-- Scan history
-- ============================================================
CREATE TABLE scan_history (
  id              INTEGER PRIMARY KEY,
  scanned_text    TEXT NOT NULL,
  normalized_code TEXT,
  matched         INTEGER DEFAULT 0,
  manufacturer_id INTEGER,
  confidence      REAL,
  scanned_at      TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- Database metadata
-- ============================================================
CREATE TABLE db_metadata (
  key   TEXT PRIMARY KEY,
  value TEXT
);
-- Stores: version, build_date, source_hash, record_count
```

---

## 7. OCR Pipeline

### 7.1 Image Preprocessing

```text
Camera Frame
  → Crop to ROI (stamp region detection)
  → Convert to grayscale
  → Adaptive threshold (handle varying lighting)
  → Deskew (correct rotation)
  → CLAHE contrast enhancement
  → Bilateral noise reduction (preserve text edges)
  → Scale normalization (consistent DPI)
  → Feed to OCR engine
```

### 7.2 OCR Engine Strategy

| Engine                          | Role      | Platform       | Status    |
| ------------------------------- | --------- | -------------- | --------- |
| @jcesarmobile/capacitor-ocr     | Primary   | Android + iOS  | Active    |
| Tesseract.js v5 (WASM)          | Fallback  | Universal      | Installed |

**Primary Engine:** `@jcesarmobile/capacitor-ocr` provides fast native OCR on both Android and iOS, suitable for mobile scanning use cases.

**Fallback:** Tesseract.js WASM serves as a client-side fallback if the primary engine is unavailable or for testing in web environments.

**Note:** Google ML Kit was originally planned but is not available for Ionic due to platform limitations. The Capacitor OCR plugin provides equivalent functionality without framework restrictions.

### 7.3 Code Normalization Engine

Transforms noisy OCR output into a canonical form for database lookup:

1. **Regex extraction:** Match `[A-Z]{2}\s*[A-Z]{0,3}\s*[\d.]{3,6}\s*[A-Z]{2,3}`
2. **EU suffix mapping:** `EG|EC|CE|WE|EF|EY` → canonical `EG`
3. **Country/state extraction:** First 2 chars → country code, then state code for DE
4. **Number cleaning:** Remove dots/spaces/dashes, zero-pad to 5 digits
5. **OCR character correction:** `O→0`, `l/I→1`, `S→5`, `B→8` (contextual)
6. **Output:** `{ country, state, number, normalized }` e.g., `{ country: 'DE', state: 'NW', number: '50264', normalized: 'NW50264' }`

### 7.4 Fuzzy Matching Strategy

| Priority | Method                  | Description                                    |
|----------|-------------------------|------------------------------------------------|
| 1        | Exact match             | `normalized_code` unique index — O(1)          |
| 2        | Partial number match    | `approval_number` with wildcards               |
| 3        | Levenshtein distance    | Distance ≤ 2, ranked by distance               |
| 4        | Digit transposition     | Swap adjacent digits, retry exact              |

**Confidence scoring:**

- ≥ 0.9: Auto-accept result
- 0.7–0.9: Show result with low-confidence warning
- < 0.7: Show "no confident match" + offer submission form

---

## 8. Admin Moderation System

### 8.1 Submission Flow

```text
Mobile Submission (queued offline)
  → Upload when online → POST /api/submissions
  → Server-side validation:
      ├── Image validation (type, size, magic bytes, EXIF strip)
      ├── Code format validation (regex)
      ├── Duplicate detection (same code + brand within 24h)
      └── Spam scoring (rate per device, honeypot fields)
  → Auto-classify into queue:
      ├── PENDING:         Valid, normal confidence
      ├── REVIEW_REQUIRED: Auto-flagged
      └── AUTO_REJECTED:   Clear spam / invalid
```

### 8.2 Suspicious Submission Detection

| Rule                              | Action               |
|-----------------------------------|----------------------|
| Missing product image             | → REVIEW queue       |
| Invalid approval code format      | → REVIEW queue       |
| Duplicate (same code + brand/24h) | → REVIEW queue       |
| OCR confidence < 0.5              | → REVIEW queue       |
| > 10 submissions/device/day       | Rate limit + flag    |
| Image too small (< 50 KB)         | → REVIEW queue       |
| Image has no EXIF data            | → REVIEW queue       |

### 8.3 Admin Dashboard Queues

1. **Pending Queue:** Normal submissions awaiting review
2. **Review Required Queue:** Auto-flagged with reason displayed
3. **Approved Queue:** Processed, exportable for ETL merge

### 8.4 Admin Actions

- **Approve:** Mark verified → add to master dataset export queue
- **Reject:** Mark rejected with reason, optionally block device
- **Edit:** Correct OCR errors before approval
- **Export:** CSV/JSON of approved entries for Python ETL pipeline merge

---

## 9. Security Model

### 9.1 Mobile App

- No authentication required for scanning/lookup (offline-first)
- Submissions: anonymous device fingerprint
- HTTPS certificate pinning for submission uploads
- Image sanitization: EXIF stripped, MIME validated client-side
- Submission queue encrypted at rest via Capacitor secure storage

### 9.2 API Server (Fastify)

- **Authentication:** JWT with refresh tokens, bcrypt password hashing
- **Authorization:** RBAC — `admin` (full access), `reviewer` (view + approve/reject)
- **Rate limiting:** `@fastify/rate-limit` — 100 req/min (API), 10 req/min (auth)
- **CORS:** Restricted to admin dashboard origin
- **Headers:** `@fastify/helmet` security headers
- **Input validation:** Ajv JSON Schema on all routes
- **File upload:** Max 5 MB, JPEG/PNG/WebP only, magic byte validation
- **CSRF:** SameSite cookies + CSRF tokens for state-changing operations

### 9.3 Admin Dashboard

- JWT stored in httpOnly cookies (not localStorage)
- Auto-logout on inactivity (15 min)
- Content Security Policy headers

---

## 10. Data Import Pipeline (ETL)

### 10.1 Pipeline Flow

```text
1. PARSE
   ├── xml_parser.py: lxml → extract betrieb elements
   └── csv_parser.py: pandas, semicolon delimiter, cp1252 encoding

2. MERGE + DEDUPLICATE
   └── Merge XML + CSV on (state_code, approval_number)
       Prefer XML (structured), fill gaps from CSV

3. NORMALIZE
   └── Zero-pad numbers, generate normalized_code, fix encoding

4. VALIDATE
   └── Format regex, duplicate check, state code validation, stats

5. BUILD
   └── Create SQLite, bulk insert, build FTS5, write metadata, VACUUM

6. OUTPUT
   └── Copy scanland.db → apps/mobile/src/assets/db/
```

### 10.2 Automation

```bash
# Cronjob (monthly, or on-demand when BVL publishes updates)
python etl/src/pipeline.py \
  --source sampledata/ \
  --output apps/mobile/src/assets/db/scanland.db
```

---

## 11. Deployment

### 11.1 Mobile App

1. ETL pipeline builds `scanland.db`
2. `build-db.sh` copies DB to mobile assets
3. `ionic build --prod` → Vite production build
4. `npx cap sync` → sync to native projects
5. Android: `./gradlew assembleRelease` → Google Play
6. iOS: `xcodebuild` → App Store Connect
7. GitHub Actions automates on tag push

### 11.2 Admin Dashboard + API (Shared Hosting)

1. SSH into server
2. `git pull` → `npm run build` (admin + server)
3. `pm2 restart scanland-api`
4. Admin SPA served as static files (Nginx/Apache or Fastify static)
5. MariaDB migrations: `npm run db:migrate`
6. Automated via GitHub Actions SSH deploy

---

## 12. Future EU Scaling Strategy

| Phase   | Scope                  | Size      | Approach                    |
|---------|------------------------|-----------|-----------------------------|
| Phase 1 | Germany (BVL)          | ~16K      | Embedded SQLite             |
| Phase 2 | Multi-country EU       | ~100–200K | Embedded SQLite (< 20 MB)   |
| Phase 3 | Community submissions  | Growing   | Embedded + online fallback  |
| Phase 4 | Real-time sync         | > 500K    | CouchDB/PouchDB HTTP        |

The SQLite schema already includes a `state_code` field that maps to country-level codes for non-German entries (e.g., `FR`, `PL`), enabling multi-country support without schema changes.

---

## 13. Monorepo Structure

```text
scaNLand/
├── apps/
│   ├── mobile/                        # Ionic 8 + Vue 3 + Capacitor 8
│   │   ├── src/
│   │   │   ├── composables/           # useOcr, useDatabase, useNormalizer,
│   │   │   │                          # useMatcher, useSubmission, useSync
│   │   │   ├── views/                 # ScannerView, ManualInputView, ResultView,
│   │   │   │                          # SubmissionView, HistoryView
│   │   │   ├── components/            # CameraPreview, CodeResult, SubmissionForm
│   │   │   ├── stores/                # Pinia stores
│   │   │   ├── router/
│   │   │   ├── assets/db/             # scanland.db (pre-built, embedded)
│   │   │   ├── App.vue
│   │   │   └── main.ts
│   │   ├── capacitor.config.ts
│   │   └── package.json
│   │
│   └── admin/                         # Vue 3 SPA (admin dashboard)
│       ├── src/
│       │   ├── views/                 # Login, Dashboard, Queues
│       │   ├── components/            # SubmissionCard, SuspicionBadge
│       │   ├── composables/           # useAuth, useSubmissions, useModeration
│       │   ├── stores/
│       │   └── main.ts
│       └── package.json
│
├── packages/
│   └── shared/                        # Shared types, validators, constants
│       ├── src/
│       │   ├── types/
│       │   ├── validators/
│       │   └── constants/
│       └── package.json
│
├── server/                            # Fastify API server
│   ├── src/
│   │   ├── routes/
│   │   ├── plugins/
│   │   ├── services/
│   │   └── db/migrations/
│   ├── ecosystem.config.cjs
│   └── package.json
│
├── etl/                               # Python ETL pipeline
│   ├── src/
│   │   ├── parsers/
│   │   ├── normalizers/
│   │   ├── builders/
│   │   └── pipeline.py
│   ├── requirements.txt
│   └── tests/
│
├── sampledata/                        # BVL source data
├── scripts/                           # Build + release scripts
├── .github/workflows/                 # CI/CD
├── ARCHITECTURE.md
├── README.md
├── package.json
└── turbo.json
```

---

## 12. Development & Network Setup (March 2026 Update)

### 12.1 Vite Configuration & Network Exposure

**Mobile app Vite config** (`apps/mobile/vite.config.ts`):

```typescript
export default defineConfig({
  server: {
    host: true,  // Expose to all network interfaces (0.0.0.0)
  },
  optimizeDeps: {
    exclude: [
      '@aspect-build/capacitor-mlkit-text-recognition',
      '@capacitor-community/sqlite',
      // ...other native packages...
    ],
  },
});
```

**Why this matters:**

- `host: true` enables accessing the dev server from other devices on the LAN (e.g., your phone)
- Without this, the dev server only listens on `localhost` (127.0.0.1)
- Native Capacitor packages must be `excluded` from Vite's dependency optimization to avoid build errors

### 12.2 Type Safety Improvements (March 2026)

**Python ETL type annotations:**

- All tuple returns now have explicit type hints (e.g., `tuple[str | Any, ...]`)
- xml_parser uses `# type: ignore` for lxml imports (expected — lxml lacks full type stubs)
- All dict variables now have explicit types (e.g., `list[dict[str, Any]]`)
- Reduced Pylance errors from ~58 to 6 (acceptable lxml warnings)

**TypeScript API response schemas:**

- auth.ts: Added 401 response schema for login failures
- submissions.ts: Added 400 response schema for validation errors
- Fastify OpenAPI documentation now reflects all possible responses

### 12.3 Monorepo Package Manager

**Root package.json constraint:**

```json
{
  "packageManager": "npm@10.8.2"
}
```

**Why (Turborepo requirement):**

- Turborepo requires developers to use a consistent package manager across the monorepo
- This field + `engines.node` ensures environment consistency
- Prevents accidental use of `yarn` or `pnpm` which would break monorepo semantics

### 12.4 Known Limitations & Future Work

1. **lxml type stubs:** Python's lxml library doesn't ship with full type annotations. This is industry-standard for compiled (C-based) packages. Warnings are acceptable.

2. **Mobile app port conflicts:** When multiple dev sessions don't clean up properly, Vite falls back to port 5174, 5175, etc. Solution: kill all Node processes and restart (`npm run dev`).

3. **Router isolation:** Some consumer routers (Fritz!Box, TP-Link, etc.) have AP/client isolation enabled by default. LAN devices must be able to reach each other. This is a **router configuration issue**, not an app bug.
