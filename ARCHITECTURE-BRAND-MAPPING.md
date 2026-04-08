# scaNLand — Brand & Product Mapping Feature

> Crowdsourced approval_code → manufacturer → brand → product mapping
> Architecture Extension — April 2026

---

## 1. Feature Overview

Approval codes identify manufacturers, but many manufacturers produce products for **multiple brands** (white-label / private-label production). This feature enables users to crowdsource a mapping between approval codes and the brands/products that actually appear on packaging.

**User prompt (after successful scan):**

> "Would you like to add the brand or product name for this item?"

**Data relationship:**

```text
approval_code (NW50264) → manufacturer (Müller GmbH)
                         → brand (Alpenhain)     → product (Back-Camembert)
                         → brand (REWE Beste Wahl) → product (Gouda jung)
                         → brand (ja!)           → product (Emmentaler)
```

---

## 2. Data Model

### 2.1 Entity Relationship

```text
┌──────────────┐       ┌───────────────────┐       ┌──────────────┐
│ manufacturers │──1:N──│ brand_mappings    │──N:1──│ brands       │
│ (existing)    │       │ (junction + meta) │       │ (new)        │
└──────────────┘       └───────┬───────────┘       └──────────────┘
                               │
                               │ 1:N
                               ▼
                       ┌───────────────────┐       ┌──────────────┐
                       │ product_mappings  │──N:1──│ products     │
                       │ (junction + meta) │       │ (new)        │
                       └───────────────────┘       └──────────────┘
                               │
                               │ 1:N
                               ▼
                       ┌───────────────────┐
                       │ mapping_images    │
                       │ (evidence photos) │
                       └───────────────────┘
```

### 2.2 SQLite Schema Extension — Server (Drizzle ORM)

```typescript
// server/src/db/schema.ts — new tables

export const brands = sqliteTable('brands', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  normalizedName: text('normalized_name').notNull(),    // lowercase, trimmed, for dedup
  country: text(),                                       // primary market (DE, FR, etc.)
  parentBrandId: integer('parent_brand_id'),             // for brand hierarchies (REWE → ja!)
  verified: integer({ mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_brand_normalized_name').on(table.normalizedName),
  index('idx_brand_country').on(table.country),
]);

export const products = sqliteTable('products', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  normalizedName: text('normalized_name').notNull(),
  brandId: integer('brand_id').notNull().references(() => brands.id),
  category: text(),                                      // dairy, meat, fish, etc.
  verified: integer({ mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_product_brand').on(table.brandId),
  index('idx_product_normalized_name').on(table.normalizedName),
]);

export const brandMappings = sqliteTable('brand_mappings', {
  id: integer().primaryKey({ autoIncrement: true }),
  normalizedCode: text('normalized_code').notNull(),     // links to manufacturers
  brandId: integer('brand_id').notNull().references(() => brands.id),
  confidence: real().notNull().default(0.0),             // 0.0–1.0 crowdsourced score
  submissionCount: integer('submission_count').notNull().default(1),
  source: text({ enum: ['user_submitted', 'admin_verified', 'etl_imported'] })
    .notNull().default('user_submitted'),
  verified: integer({ mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_bm_normalized_code').on(table.normalizedCode),
  index('idx_bm_brand').on(table.brandId),
  index('idx_bm_confidence').on(table.confidence),
]);

export const productMappings = sqliteTable('product_mappings', {
  id: integer().primaryKey({ autoIncrement: true }),
  brandMappingId: integer('brand_mapping_id').notNull()
    .references(() => brandMappings.id),
  productId: integer('product_id').notNull().references(() => products.id),
  confidence: real().notNull().default(0.0),
  submissionCount: integer('submission_count').notNull().default(1),
  source: text({ enum: ['user_submitted', 'admin_verified', 'etl_imported'] })
    .notNull().default('user_submitted'),
  verified: integer({ mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_pm_brand_mapping').on(table.brandMappingId),
  index('idx_pm_product').on(table.productId),
]);

export const mappingImages = sqliteTable('mapping_images', {
  id: integer().primaryKey({ autoIncrement: true }),
  brandMappingId: integer('brand_mapping_id')
    .references(() => brandMappings.id),
  productMappingId: integer('product_mapping_id')
    .references(() => productMappings.id),
  imageUrl: text('image_url').notNull(),
  imageHash: text('image_hash').notNull(),              // SHA-256 perceptual hash for dedup
  fileSizeBytes: integer('file_size_bytes'),
  width: integer(),
  height: integer(),
  mimeType: text('mime_type'),
  deviceFingerprint: text('device_fingerprint'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_mi_brand_mapping').on(table.brandMappingId),
  index('idx_mi_product_mapping').on(table.productMappingId),
  index('idx_mi_image_hash').on(table.imageHash),
]);

export const mappingSubmissions = sqliteTable('mapping_submissions', {
  id: integer().primaryKey({ autoIncrement: true }),
  normalizedCode: text('normalized_code').notNull(),
  brandName: text('brand_name').notNull(),
  productName: text('product_name').notNull(),
  productImageUrl: text('product_image_url').notNull(),  // REQUIRED
  imageHash: text('image_hash').notNull(),
  companyName: text('company_name'),
  address: text(),
  country: text(),
  region: text(),
  notes: text(),
  deviceFingerprint: text('device_fingerprint'),
  ocrConfidence: real('ocr_confidence'),
  moderationStatus: text('moderation_status', {
    enum: ['pending', 'approved', 'rejected'],
  }).notNull().default('pending'),
  moderationQueue: text('moderation_queue', {
    enum: ['pending', 'review_required', 'approved', 'auto_rejected'],
  }).notNull().default('pending'),
  suspicionReasons: text('suspicion_reasons', { mode: 'json' })
    .$type<string[]>().default([]),
  resolvedBrandId: integer('resolved_brand_id'),         // set on approval
  resolvedProductId: integer('resolved_product_id'),     // set on approval
  reviewedBy: integer('reviewed_by'),
  reviewedAt: text('reviewed_at'),
  rejectionReason: text('rejection_reason'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_ms_normalized_code').on(table.normalizedCode),
  index('idx_ms_moderation_queue').on(table.moderationQueue),
  index('idx_ms_image_hash').on(table.imageHash),
  index('idx_ms_created_at').on(table.createdAt),
]);
```

### 2.3 SQLite Schema Extension — Mobile (Embedded, read-only lookup)

Added to the embedded `scanland.db` built by the ETL pipeline:

```sql
-- Brands known for this manufacturer
CREATE TABLE IF NOT EXISTS brands (
  id               INTEGER PRIMARY KEY,
  name             TEXT NOT NULL,
  normalized_name  TEXT NOT NULL,
  country          TEXT,
  parent_brand_id  INTEGER,
  verified         INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_brand_normalized ON brands(normalized_name);

-- Products under each brand
CREATE TABLE IF NOT EXISTS products (
  id               INTEGER PRIMARY KEY,
  name             TEXT NOT NULL,
  normalized_name  TEXT NOT NULL,
  brand_id         INTEGER NOT NULL REFERENCES brands(id),
  category         TEXT,
  verified         INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_product_brand ON products(brand_id);

-- Junction: which brands map to which approval codes
CREATE TABLE IF NOT EXISTS brand_mappings (
  id               INTEGER PRIMARY KEY,
  normalized_code  TEXT NOT NULL,
  brand_id         INTEGER NOT NULL REFERENCES brands(id),
  confidence       REAL DEFAULT 0.0,
  submission_count INTEGER DEFAULT 0,
  verified         INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_bm_code ON brand_mappings(normalized_code);

-- Junction: which products map to which brand+code combination
CREATE TABLE IF NOT EXISTS product_mappings (
  id               INTEGER PRIMARY KEY,
  brand_mapping_id INTEGER NOT NULL REFERENCES brand_mappings(id),
  product_id       INTEGER NOT NULL REFERENCES products(id),
  confidence       REAL DEFAULT 0.0,
  submission_count INTEGER DEFAULT 0,
  verified         INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_pm_bm ON product_mappings(brand_mapping_id);

-- FTS for brand/product search
CREATE VIRTUAL TABLE IF NOT EXISTS brands_fts USING fts5(
  name, normalized_name,
  content='brands', content_rowid='id'
);

-- Image references (URLs only — images served by API)
CREATE TABLE IF NOT EXISTS mapping_image_refs (
  id                 INTEGER PRIMARY KEY,
  brand_mapping_id   INTEGER,
  product_mapping_id INTEGER,
  image_url          TEXT NOT NULL
);
```

### 2.4 Mobile Offline Queue Extension

New table in the local Capacitor SQLite database for queuing brand/product mapping submissions:

```sql
CREATE TABLE IF NOT EXISTS mapping_submission_queue (
  id                  INTEGER PRIMARY KEY,
  normalized_code     TEXT NOT NULL,
  brand_name          TEXT NOT NULL,
  product_name        TEXT NOT NULL,
  product_image_path  TEXT NOT NULL,
  company_name        TEXT,
  address             TEXT,
  country             TEXT,
  region              TEXT,
  notes               TEXT,
  ocr_confidence      REAL,
  status              TEXT DEFAULT 'pending',
  created_at          TEXT DEFAULT (datetime('now')),
  retry_count         INTEGER DEFAULT 0,
  last_error          TEXT
);
```

---

## 3. Confidence Scoring Strategy

### 3.1 Score Computation

Each brand↔approval_code mapping accumulates a confidence score based on crowdsourced signals:

```text
confidence = min(1.0, base_score + submission_bonus + verification_bonus)

base_score          = 0.1   (first submission)
submission_bonus    = 0.1 × min(unique_submitters, 5)  (caps at +0.5)
image_bonus         = 0.1   (image included and validated)
verification_bonus  = 0.3   (admin-verified)
duplicate_penalty   = -0.05 (same device submitting again)
```

### 3.2 Score Thresholds

| Score    | Status              | Display                              |
| -------- | ------------------- | ------------------------------------ |
| ≥ 0.8   | High confidence     | Shown by default, green badge        |
| 0.5–0.79 | Medium confidence  | Shown with "community reported" tag  |
| 0.2–0.49 | Low confidence     | Shown only if user opts in           |
| < 0.2   | Unverified          | Not shown in mobile app              |

### 3.3 Admin Override

Admins can set `verified = true` on any mapping, which locks the confidence at 1.0 and marks the source as `admin_verified`. Verified mappings are included in the embedded database.

---

## 4. Mobile UX Flow

### 4.1 Flow Diagram

```text
┌─────────────┐
│ User scans  │
│ approval    │
│ code        │
│             │
└──────┬──────┘
       │
       ▼
┌──────────────┐     No match     ┌──────────────────────┐
│ ResultView   │─────────────────►│ Existing Submit Flow │
│ (match found)│                  │ (SubmissionView)     │
└──────┬───────┘                  └──────────────────────┘
       │
       │ Show prompt:
       │ "Would you like to add the
       │  brand or product name
       │  for this item?"
       │
       ├─── [Skip] ──► Scanner (done)
       │
       ├─── [Later] ──► Dismiss, add to scan history
       │                with "add mapping" badge
       │
       └─── [Yes] ──► BrandMappingView
                          │
                          ├─ Brand name (required, autocomplete)
                          ├─ Product name (required, autocomplete)
                          ├─ Product image (REQUIRED, camera/gallery)
                          ├─ Company name on packaging (optional)
                          ├─ Address if visible (optional)
                          ├─ Country (optional)
                          ├─ Region (optional)
                          ├─ Notes (optional)
                          │
                          ▼
                 ┌─────────────────┐
                 │ Image validation│
                 │ • Size ≥ 50 KB  │
                 │ • Size ≤ 5 MB   │
                 │ • JPEG/PNG/WebP │
                 │ • Min 200×200   │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │ Queue locally   │
                 │ (offline-safe)  │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │ Toast: "Saved!  │
                 │ Will upload     │
                 │ when online."   │
                 └────────┬────────┘
                          │
                          ▼
                    Return to
                    ResultView
```

### 4.2 Integration Points in Existing Views

#### ResultView.vue — Add Mapping Prompt

After the existing "Match found" card, add a new section:

```text
Location: apps/mobile/src/views/ResultView.vue
Trigger: result.matched === true && result.confidence >= 0.7
Element: <ion-card> with prompt text + [Yes] [Skip] [Later] buttons
```

The prompt appears **below** the manufacturer result card, non-intrusively. The "Skip" button dismisses it. "Later" stores a flag in `scan_history` enabling re-access from the History tab.

#### HistoryView.vue — "Add Mapping" Badge

Scans where the user chose "Later" show a small badge/chip. Tapping the history entry navigates to `BrandMappingView` with the approval code pre-filled.

### 4.3 New View: BrandMappingView

```text
Location: apps/mobile/src/views/BrandMappingView.vue
Route:    /brand-mapping
```

**Form fields:**

| Field        | Required | Type                       | Notes                                     |
| ------------ | -------- | -------------------------- | ----------------------------------------- |
| Approval Code | Yes (pre-filled, read-only) | text          | From scan result                  |
| Brand Name   | Yes      | **searchable dropdown**    | Select existing OR type new brand         |
| Product Name | Yes      | **searchable dropdown**    | Select existing (filtered by brand) OR type new |
| Product Image | **Yes** | camera/gallery             | Validated before queue                    |
| Company Name | No       | text                       | As shown on packaging                     |
| Address      | No       | text                       | If visible on packaging                   |
| Country      | No       | select                     | Reuse existing country dropdown           |
| Region       | No       | text                       | State/province                            |
| Notes        | No       | textarea                   | Additional context                        |

#### Brand Name — Searchable Dropdown (Combobox)

The brand field uses a **combobox pattern** (searchable dropdown + free text) to prevent duplicate brands:

```text
┌────────────────────────────────────┐
│ Brand Name *                       │
│ ┌────────────────────────────────┐ │
│ │ Alpen...                    ▼  │ │  ← user types, dropdown opens
│ └────────────────────────────────┘ │
│ ┌────────────────────────────────┐ │
│ │ ★ Alpenhain               (DE) │ │  ← existing brand (verified ★)
│ │   Alpenmark               (DE) │ │  ← existing brand
│ │   Alpine Dairy            (AT) │ │  ← existing brand
│ │ ─────────────────────────────── │ │
│ │ ＋ Add "Alpen..." as new brand │ │  ← create new option
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

**Implementation — `ion-modal` with `ion-searchbar` + `ion-list`:**

Ionic doesn't have a native combobox, so this is built as:

1. An `ion-input` (read-only display) that opens an `ion-modal` on tap
2. Inside the modal: `ion-searchbar` at top + `ion-list` of matching brands
3. Brands queried from embedded SQLite `brands` table via `searchBrands()`
4. Matches ranked: exact match first, then prefix, then fuzzy (FTS5)
5. Verified brands (★) shown first within each rank
6. A separator + "Add as new brand" option always at the bottom
7. Selecting an existing brand sets `selectedBrandId` (links to DB record)
8. Selecting "Add new" stores the raw text in `brandName` with `selectedBrandId = null`

**Deduplication logic (client-side):**

- Normalize input: lowercase, trim, collapse whitespace
- Check `brands.normalized_name` for exact match → suggest existing
- Check Levenshtein distance ≤ 2 → show "Did you mean: X?" prompt
- Common variations caught: "Dr. Oetker" vs "Dr Oetker", "Müller" vs "Mueller"

#### Product Name — Searchable Dropdown (filtered by brand)

Same combobox pattern as brand, but filtered:

- If an **existing brand** was selected: show only products already linked to that brand
- If a **new brand** was typed: show empty list + "Add as new product" only
- Products queried from `products` table via `searchProducts(brandId, query)`

```text
┌────────────────────────────────────┐
│ Product Name *                     │
│ ┌────────────────────────────────┐ │
│ │ Cam...                      ▼  │ │
│ └────────────────────────────────┘ │
│ ┌────────────────────────────────┐ │
│ │   Back-Camembert               │ │  ← existing product for Alpenhain
│ │   Camembert Natur              │ │
│ │ ─────────────────────────────── │ │
│ │ ＋ Add "Cam..." as new product │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

**Why dropdown select instead of free text:**

- Prevents "Alpenhain" vs "alpenhain" vs "Alpenhain " duplicates
- Reuses verified brand records, boosting mapping confidence
- Reduces admin merge workload
- Still allows new entries when the brand genuinely doesn't exist

### 4.4 Router Change

```typescript
// apps/mobile/src/router/index.ts — add route
{
  path: '/brand-mapping',
  component: () => import('@/views/BrandMappingView.vue'),
}
```

---

## 5. Submission & Sync Workflow

### 5.1 Offline Queue Flow

```text
User fills form
  │
  ▼
Client-side validation
  ├─ Brand name: required, 1–200 chars
  ├─ Product name: required, 1–200 chars
  ├─ Image: required, 50KB–5MB, JPEG/PNG/WebP, ≥200×200
  ├─ Approval code: valid format (existing validator)
  │
  ▼
Compress image
  ├─ Target: 80% quality JPEG
  ├─ Max dimension: 1200px
  ├─ Save to Capacitor Filesystem
  │
  ▼
INSERT into mapping_submission_queue
  ├─ status = 'pending'
  ├─ Save image file path
  │
  ▼
Toast: "Saved! Will upload when online."
```

### 5.2 Upload Sync (extends useSync.ts)

The existing `useSync` composable is extended to also process `mapping_submission_queue`:

```text
Network comes online
  │
  ▼
uploadPending() — existing submissions
  │
  ▼
uploadPendingMappings() — NEW
  │
  ├─ SELECT * FROM mapping_submission_queue
  │    WHERE status IN ('pending', 'failed')
  │    AND retry_count < 5
  │    ORDER BY created_at ASC
  │
  ▼
  For each:
  ├─ Set status = 'uploading'
  ├─ Read image from Filesystem
  ├─ Build multipart FormData
  ├─ POST /api/mapping-submissions
  │   ├─ 201 → status = 'uploaded'
  │   ├─ 4xx → status = 'failed', store error
  │   └─ 5xx/network → status = 'failed', increment retry_count
  │
  ▼
Done
```

### 5.3 Retry Strategy

| Retry Count | Delay          | Action                            |
| ----------- | -------------- | --------------------------------- |
| 0           | Immediate      | First attempt                     |
| 1           | 30 seconds     | Quick retry                       |
| 2           | 5 minutes      | Short delay                       |
| 3           | 30 minutes     | Medium delay                      |
| 4           | 2 hours        | Long delay                        |
| ≥ 5         | —              | Stop retrying, user must trigger  |

Retry delay is computed as: `min(delay, remaining_time_until_next_network_change)`. In practice, the sync fires on every network status change, so retries happen naturally whenever the device reconnects.

### 5.4 Conflict Handling

| Scenario                        | Strategy                                           |
| ------------------------------- | -------------------------------------------------- |
| Same brand+code from same device | Deduplicate client-side: check queue before insert |
| Same brand+code from different devices | Server merges: increment `submission_count`, recalculate confidence |
| Brand name typo variants        | Server normalizes: lowercase, trim, collapse whitespace. Admin can merge |
| Image already exists (hash match) | Server flags as duplicate, still accepts submission metadata |
| Conflicting product info        | Both stored. Admin resolves via merge UI           |

---

## 6. Server API Extensions

### 6.1 New Routes

```text
POST   /api/mapping-submissions          — Submit a brand/product mapping
GET    /api/brands                        — List/search brands (public, for autocomplete)
GET    /api/brands/:id/products           — Products for a brand

GET    /api/admin/mapping-submissions     — List mapping submissions (filtered)
GET    /api/admin/mapping-submissions/:id — Detail view
PATCH  /api/admin/mapping-submissions/:id/approve  — Approve + create/link brand+product
PATCH  /api/admin/mapping-submissions/:id/reject   — Reject with reason
GET    /api/admin/brands                  — Manage brands
POST   /api/admin/brands/merge            — Merge duplicate brands
GET    /api/admin/products                — Manage products
POST   /api/admin/products/merge          — Merge duplicate products
GET    /api/admin/mapping-stats           — Dashboard statistics
```

### 6.2 POST /api/mapping-submissions

**Request:** `multipart/form-data`

| Field         | Required | Type     |
| ------------- | -------- | -------- |
| normalizedCode | Yes     | string   |
| brandName     | Yes      | string   |
| productName   | Yes      | string   |
| image         | **Yes**  | file     |
| companyName   | No       | string   |
| address       | No       | string   |
| country       | No       | string   |
| region        | No       | string   |
| notes         | No       | string   |
| ocrConfidence | No       | number   |

**Server processing:**

1. Validate approval code format
2. Validate image (size, type, dimensions)
3. Compute image SHA-256 hash
4. Check for duplicate image hash → flag if found
5. Run spam analysis (existing + new rules)
6. Save image to disk
7. Insert into `mapping_submissions`
8. Return `{ id, status }`

**Response:** `201 Created`

```json
{ "id": 42, "status": "pending" }
```

### 6.3 PATCH /api/admin/mapping-submissions/:id/approve

**Processing on approval:**

1. Find or create `brand` record (normalize name, check for existing)
2. Find or create `product` record (normalize name, link to brand)
3. Find or create `brand_mapping` (normalized_code ↔ brand)
4. Find or create `product_mapping` (brand_mapping ↔ product)
5. Move image to `mapping_images` table
6. Increment `submission_count`, recalculate `confidence`
7. Set `verified = true` if admin explicitly verifies
8. Update submission status to `approved`
9. Write audit log entry

### 6.4 POST /api/admin/brands/merge

**Request:**

```json
{
  "sourceIds": [3, 7, 12],
  "targetId": 3
}
```

**Processing:**

1. Reassign all `brand_mappings` from source brands to target
2. Reassign all `products` from source brands to target
3. Delete source brand records
4. Write audit log

### 6.5 File Structure — New Server Routes

```text
server/src/routes/
  ├── auth.ts                    (existing)
  ├── submissions.ts             (existing)
  ├── admin.ts                   (existing)
  ├── mapping-submissions.ts     (NEW — public submission endpoint)
  ├── brands.ts                  (NEW — public brand search)
  └── admin-mappings.ts          (NEW — admin mapping management)
```

---

## 7. Spam Prevention & Image Validation

### 7.1 Extended Spam Analysis

New function in `server/src/services/spam.ts`:

```text
analyzeMappingSubmission(data):
  1. All existing checks (URL detection, length, character repetition)
  2. Approval code format validation (existing validator)
  3. Image required — reject if missing
  4. Image hash duplicate check (query mapping_images + mapping_submissions)
  5. Image too small (< 50 KB) → flag
  6. Brand/product name identical → flag
  7. Brand name matches known spam patterns → flag
```

### 7.2 Rate Limiting Strategy

| Scope                    | Limit                | Window   |
| ------------------------ | -------------------- | -------- |
| Global API               | 100 req/min          | 1 minute |
| Mapping submissions (IP) | 10 submissions       | 1 hour   |
| Mapping submissions (device) | 20 submissions   | 24 hours |
| Same approval code (device) | 3 submissions     | 24 hours |

Rate limiting is enforced via `@fastify/rate-limit` with device fingerprint from the `X-Device-Id` header as a secondary key.

### 7.3 Image Validation Pipeline

```text
Image received
  │
  ├── Magic byte check (JPEG FFD8, PNG 89504E47, WebP 52494646)
  ├── MIME type match (image/jpeg, image/png, image/webp)
  ├── File size: 50 KB – 5 MB
  ├── Dimensions: ≥ 200×200 px
  ├── Compute SHA-256 hash
  ├── Strip EXIF metadata (privacy)
  │
  ▼
  Duplicate hash check
  ├── Exact match in mapping_images → flag "duplicate_image"
  ├── Exact match in mapping_submissions (other pending) → flag "duplicate_pending"
  │
  ▼
  Save to /uploads/mappings/{nanoid}.{ext}
```

### 7.4 Image Hashing Strategy

**Primary:** SHA-256 of raw file bytes — catches exact re-uploads.

**Future (Phase 2):** Perceptual hashing (pHash/dHash) via `sharp` — catches slightly modified re-uploads (cropped, re-compressed, color-shifted). Not in v1 to avoid adding a native dependency.

### 7.5 Suspicious Upload Detection

| Signal                              | Suspicion Level | Action          |
| ----------------------------------- | --------------- | --------------- |
| No product image                    | **Auto-reject** | Block           |
| Image < 50 KB                       | High            | → review queue  |
| Image hash duplicate (exact)        | High            | → review queue  |
| Invalid approval code format        | High            | → review queue  |
| brand_name === product_name         | Medium          | → review queue  |
| > 10 submissions from device/24h    | Medium          | → review queue  |
| Notes contain URL                   | Medium          | → review queue  |
| Brand name > 100 chars              | Low             | Flag reason     |

---

## 8. Admin Dashboard Extensions

### 8.1 New Views

```text
apps/admin/src/views/
  ├── AdminLayout.vue              (existing — add nav items)
  ├── DashboardView.vue            (existing — add mapping stats card)
  ├── MappingSubmissionsView.vue   (NEW — mapping review queue)
  ├── MappingDetailView.vue        (NEW — single mapping review)
  ├── BrandsView.vue               (NEW — brand management + merge)
  └── ProductsView.vue             (NEW — product management + merge)
```

### 8.2 MappingSubmissionsView

**Layout:** Data table identical to existing `SubmissionsView`, with columns:

| Column         | Source                    |
| -------------- | ------------------------- |
| ID             | mapping_submissions.id    |
| Approval Code  | normalized_code           |
| Brand          | brand_name                |
| Product        | product_name              |
| Image          | Thumbnail preview         |
| Queue          | moderation_queue          |
| Status         | moderation_status         |
| Submitted      | created_at                |

**Filters:** Queue (pending / review_required / approved / auto_rejected), date range.

### 8.3 MappingDetailView

**Layout:**

```text
┌─────────────────────────────────────────────────────────────┐
│  Mapping Submission #42                                      │
├──────────────────────────────┬──────────────────────────────┤
│                              │                              │
│  Product Image               │  Submission Details          │
│  ┌────────────────────┐      │  • Approval Code: NW 50264  │
│  │                    │      │  • Brand: Alpenhain          │
│  │    (image with     │      │  • Product: Back-Camembert   │
│  │     zoom support)  │      │  • Company: (optional)       │
│  │                    │      │  • Country: DE               │
│  │                    │      │  • Notes: "Found at REWE"    │
│  └────────────────────┘      │                              │
│                              │  Manufacturer (from DB)      │
│  [Zoom In] [Zoom Out]       │  • Müller Käse GmbH          │
│  [Full Screen]              │  • 50264, Pulheim             │
│                              │                              │
│                              │  Moderation                  │
│                              │  • Queue: review_required    │
│                              │  • Flags: [duplicate_image]  │
│                              │                              │
├──────────────────────────────┴──────────────────────────────┤
│                                                              │
│  Admin Actions                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Brand: [Alpenhain        ▼] (select existing/new)   │   │
│  │  Product: [Back-Camembert ▼] (select existing/new)   │   │
│  │                                                      │   │
│  │  [✓ Approve]  [✗ Reject]  [Merge Brand]  [Merge Prod]│   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Rejection Reason: [________________________]                │
│                                                              │
│  Existing Mappings for NW50264:                              │
│  ┌──────────────────────────────────────┐                   │
│  │ Brand         │ Product    │ Conf.   │                   │
│  │ Alpenhain     │ Camembert  │ 0.82 ✓  │                   │
│  │ REWE Beste W. │ Gouda      │ 0.45    │                   │
│  └──────────────────────────────────────┘                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Image panel features:**

- Click to zoom (CSS transform)
- Pinch-to-zoom on touch devices
- Full-screen overlay mode
- Image dimensions and file size displayed

### 8.4 BrandsView — Brand Management

**Capabilities:**

- List all brands with submission count, mapping count
- Search/filter brands
- Edit brand name
- Merge duplicates: select 2+ brands → merge into one (reassigns all mappings)
- Delete brand (if no approved mappings)

### 8.5 ProductsView — Product Management

**Capabilities:**

- List products grouped by brand
- Edit product name/category
- Merge duplicate products within same brand
- Delete product (if no approved mappings)

### 8.6 Dashboard Stats Extension

Add new stat cards to `DashboardView.vue`:

```text
Existing:
[Pending Submissions] [Needs Review] [Approved] [Rejected]

New row:
[Pending Mappings] [Needs Mapping Review] [Total Brands] [Total Products]
```

### 8.7 Admin Router Extension

```typescript
// apps/admin/src/router.ts — new routes
{ path: '/mapping-submissions', component: MappingSubmissionsView },
{ path: '/mapping-submissions/:id', component: MappingDetailView },
{ path: '/brands', component: BrandsView },
{ path: '/products', component: ProductsView },
```

### 8.8 AdminLayout.vue — Navigation Extension

Add to sidebar navigation:

```text
─── Submissions       (existing)
─── Mapping Submissions  (NEW)
─── Brands              (NEW)
─── Products            (NEW)
```

---

## 9. ETL Pipeline Extensions

### 9.1 Extended Pipeline Flow

```text
EXISTING PIPELINE (unchanged):
1. PARSE    — BVL XML + CSV
2. MERGE    — Deduplicate on (state_code, approval_number)
3. NORMALIZE — Zero-pad, generate normalized_code
4. VALIDATE  — Format checks
5. BUILD    — manufacturers table + FTS5

NEW PIPELINE STAGE (added after BUILD):
6. MERGE MAPPINGS
   ├── Export approved brand_mappings from server DB
   ├── Export approved products from server DB
   ├── Export approved brands from server DB
   ├── Filter: only verified OR confidence ≥ 0.5
   ├── Insert into embedded DB: brands, products, brand_mappings, product_mappings
   ├── Build brands_fts index
   ├── Insert mapping_image_refs (URL references only, no binary data)
   │
7. VERSION
   ├── Write db_metadata: mapping_version, mapping_count, mapping_build_date
   ├── Compute mapping_hash for change detection
```

### 9.2 New ETL Module

```text
etl/src/
  ├── builders/
  │   ├── sqlite_builder.py       (existing — extend)
  │   └── mapping_builder.py      (NEW — merge approved mappings)
  ├── exporters/
  │   └── server_exporter.py      (NEW — export from server SQLite)
```

### 9.3 mapping_builder.py — Responsibilities

```python
"""
Merges approved brand/product mappings from the server database
into the mobile-embedded scanland.db.
"""

def merge_mappings(
    mobile_db_path: Path,
    server_db_path: Path,
    min_confidence: float = 0.5,
    verified_only: bool = False,
) -> MergeResult:
    """
    1. Connect to server DB (read-only)
    2. Query approved brands, products, brand_mappings, product_mappings
    3. Filter by confidence threshold or verified flag
    4. Insert into mobile DB (brands, products, brand_mappings, product_mappings)
    5. Insert image URL references (mapping_image_refs)
    6. Build brands_fts index
    7. Update db_metadata with mapping stats
    8. Return MergeResult with counts
    """
```

### 9.4 sqlite_builder.py — Extension

The existing `SCHEMA_SQL` is extended with the new tables (brands, products, brand_mappings, product_mappings, brands_fts, mapping_image_refs). These tables are created empty during the initial build and populated by `mapping_builder.py`.

### 9.5 Dataset Versioning

```text
db_metadata additions:
  mapping_version     = "1.0.0"
  mapping_build_date  = "2026-04-01T12:00:00Z"
  mapping_count       = "342"
  mapping_hash        = "abc123..."
  brands_count        = "87"
  products_count      = "215"
```

### 9.6 Monthly Rebuild Workflow

```bash
# Full rebuild including mappings
python etl/src/pipeline.py \
  --source sampledata/ \
  --output apps/mobile/src/assets/db/scanland.db \
  --server-db server/data/scanland.db \
  --include-mappings \
  --min-confidence 0.5
```

**Workflow:**

```text
1. BVL data updated (rare) OR monthly mapping merge cycle
2. ETL pipeline runs:
   a. Rebuild manufacturers from BVL data
   b. Export approved mappings from server
   c. Merge into mobile DB
3. scripts/build-db.sh copies DB to mobile assets
4. Version bump
5. GitHub Actions builds native apps
6. Submit to app stores
```

---

## 10. New Shared Types

```typescript
// packages/shared/src/types/mapping.ts

export interface Brand {
  id: number;
  name: string;
  normalizedName: string;
  country?: string;
  parentBrandId?: number;
  verified: boolean;
}

export interface Product {
  id: number;
  name: string;
  normalizedName: string;
  brandId: number;
  category?: string;
  verified: boolean;
}

export interface BrandMapping {
  id: number;
  normalizedCode: string;
  brandId: number;
  brand?: Brand;
  confidence: number;
  submissionCount: number;
  source: MappingSource;
  verified: boolean;
}

export interface ProductMapping {
  id: number;
  brandMappingId: number;
  productId: number;
  product?: Product;
  confidence: number;
  submissionCount: number;
  source: MappingSource;
  verified: boolean;
}

export type MappingSource = 'user_submitted' | 'admin_verified' | 'etl_imported';

export interface MappingSubmission {
  id?: number;
  normalizedCode: string;
  brandName: string;
  productName: string;
  selectedBrandId?: number;         // set if user picked existing brand from dropdown
  selectedProductId?: number;       // set if user picked existing product from dropdown
  productImagePath?: string;        // mobile (local file)
  productImageUrl?: string;         // server (upload URL)
  imageHash?: string;
  companyName?: string;
  address?: string;
  country?: string;
  region?: string;
  notes?: string;
  ocrConfidence?: number;
  status: MappingSubmissionStatus;
  createdAt?: string;
  retryCount?: number;
  lastError?: string;
}

export type MappingSubmissionStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

export interface ServerMappingSubmission
  extends Omit<MappingSubmission, 'status' | 'productImagePath'> {
  id: number;
  productImageUrl: string;
  imageHash: string;
  deviceFingerprint?: string;
  moderationStatus: ModerationStatus;
  moderationQueue: ModerationQueue;
  suspicionReasons: string[];
  resolvedBrandId?: number;
  resolvedProductId?: number;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MappingImageRef {
  id: number;
  brandMappingId?: number;
  productMappingId?: number;
  imageUrl: string;
}
```

---

## 11. New Mobile Composable: useBrandMapping

```text
Location: apps/mobile/src/composables/useBrandMapping.ts
```

**Responsibilities:**

```typescript
export function useBrandMapping() {
  // === Offline Lookup (embedded DB) ===

  /** Get all brand mappings for a normalized code */
  getBrandsForCode(normalizedCode: string): Promise<BrandMapping[]>

  /** Get all products for a brand mapping */
  getProductsForBrandMapping(brandMappingId: number): Promise<ProductMapping[]>

  /**
   * Search brands by name for the searchable dropdown.
   * 1. Query brands_fts for prefix/fuzzy matches
   * 2. Sort: verified first, then by name
   * 3. Return with match metadata (exact, prefix, fuzzy)
   */
  searchBrands(query: string, limit?: number): Promise<BrandSearchResult[]>

  /**
   * Search products filtered by brand for the searchable dropdown.
   * If brandId is null (new brand), returns empty array.
   */
  searchProducts(brandId: number | null, query: string, limit?: number): Promise<Product[]>

  /**
   * Normalize a brand name for dedup comparison.
   * lowercase → trim → collapse whitespace → strip punctuation
   * "Dr. Oetker" → "dr oetker", "REWE  Beste Wahl" → "rewe beste wahl"
   */
  normalizeBrandName(name: string): string

  /**
   * Check if a brand name is a near-duplicate of an existing brand.
   * Returns the existing brand if Levenshtein distance ≤ 2 on normalized names.
   */
  findSimilarBrand(name: string): Promise<Brand | null>

  // === Offline Queue (local DB) ===

  /** Queue a brand/product mapping submission locally */
  queueMappingSubmission(submission: Omit<MappingSubmission, 'id' | 'status'>): Promise<number>

  /** Get pending mapping submissions */
  getPendingMappingSubmissions(): Promise<MappingSubmission[]>

  /** Check for duplicate submission in local queue */
  isDuplicate(normalizedCode: string, brandName: string): Promise<boolean>

  /** Update submission status */
  updateMappingStatus(id: number, status: string, error?: string): Promise<void>
}

interface BrandSearchResult {
  brand: Brand;
  matchType: 'exact' | 'prefix' | 'fuzzy';
}
```

---

## 12. New Shared Validators

```typescript
// packages/shared/src/validators/mapping.validator.ts

export function validateMappingSubmission(data: {
  normalizedCode: string;
  brandName: string;
  productName: string;
  productImagePath?: string;
  productImageUrl?: string;
}): ValidationResult {
  const errors: string[] = [];

  if (!data.normalizedCode || data.normalizedCode.length < 3) {
    errors.push('Valid approval code is required');
  }
  if (!data.brandName || data.brandName.trim().length === 0) {
    errors.push('Brand name is required');
  }
  if (data.brandName && data.brandName.length > 200) {
    errors.push('Brand name must be 200 characters or less');
  }
  if (!data.productName || data.productName.trim().length === 0) {
    errors.push('Product name is required');
  }
  if (data.productName && data.productName.length > 200) {
    errors.push('Product name must be 200 characters or less');
  }
  if (!data.productImagePath && !data.productImageUrl) {
    errors.push('Product image is required');
  }

  return { valid: errors.length === 0, errors };
}

export function validateMappingImage(file: {
  size: number;
  type: string;
}): ValidationResult {
  const errors: string[] = [];
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MIN_SIZE = 50 * 1024;       // 50 KB
  const MAX_SIZE = 5 * 1024 * 1024;  // 5 MB

  if (!ALLOWED_TYPES.includes(file.type)) {
    errors.push('Image must be JPEG, PNG, or WebP');
  }
  if (file.size < MIN_SIZE) {
    errors.push('Image must be at least 50 KB');
  }
  if (file.size > MAX_SIZE) {
    errors.push('Image must be 5 MB or less');
  }

  return { valid: errors.length === 0, errors };
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

---

## 13. Updated Folder Structure

```text
scaNLand/
├── apps/
│   ├── mobile/
│   │   ├── src/
│   │   │   ├── composables/
│   │   │   │   ├── useBrandMapping.ts       ← NEW
│   │   │   │   ├── useDatabase.ts           (existing)
│   │   │   │   ├── useMatcher.ts            (existing)
│   │   │   │   ├── useNormalizer.ts          (existing)
│   │   │   │   ├── useOcr.ts                (existing)
│   │   │   │   ├── useSubmission.ts          (existing)
│   │   │   │   └── useSync.ts               (EXTEND — add mapping sync)
│   │   │   ├── views/
│   │   │   │   ├── BrandMappingView.vue     ← NEW
│   │   │   │   ├── HistoryView.vue          (EXTEND — add mapping badge)
│   │   │   │   ├── ManualInputView.vue      (existing)
│   │   │   │   ├── ResultView.vue           (EXTEND — add mapping prompt)
│   │   │   │   ├── ScannerView.vue          (existing)
│   │   │   │   ├── SubmissionView.vue       (existing)
│   │   │   │   └── TabsLayout.vue           (existing)
│   │   │   ├── stores/
│   │   │   │   ├── scan.ts                  (existing)
│   │   │   │   └── settings.ts              (existing)
│   │   │   └── router/
│   │   │       └── index.ts                 (EXTEND — add /brand-mapping)
│   │   └── ...
│   │
│   └── admin/
│       ├── src/
│       │   ├── views/
│       │   │   ├── AdminLayout.vue          (EXTEND — add nav items)
│       │   │   ├── BrandsView.vue           ← NEW
│       │   │   ├── DashboardView.vue        (EXTEND — add mapping stats)
│       │   │   ├── LoginView.vue            (existing)
│       │   │   ├── MappingDetailView.vue    ← NEW
│       │   │   ├── MappingSubmissionsView.vue ← NEW
│       │   │   ├── ProductsView.vue         ← NEW
│       │   │   ├── SubmissionDetailView.vue  (existing)
│       │   │   └── SubmissionsView.vue       (existing)
│       │   ├── stores/
│       │   │   └── auth.ts                  (existing)
│       │   └── router.ts                    (EXTEND — add new routes)
│       └── ...
│
├── packages/
│   └── shared/
│       └── src/
│           ├── types/
│           │   ├── approval-code.ts          (existing)
│           │   ├── api.ts                    (EXTEND — add mapping API types)
│           │   ├── mapping.ts               ← NEW
│           │   └── submission.ts             (existing)
│           ├── constants/                    (existing, unchanged)
│           └── validators/
│               ├── approval-code.validator.ts (existing)
│               ├── mapping.validator.ts      ← NEW
│               └── submission.validator.ts    (existing)
│
├── server/
│   └── src/
│       ├── db/
│       │   ├── index.ts                     (existing)
│       │   └── schema.ts                    (EXTEND — add new tables)
│       ├── routes/
│       │   ├── admin.ts                     (existing)
│       │   ├── admin-mappings.ts            ← NEW
│       │   ├── auth.ts                      (existing)
│       │   ├── brands.ts                    ← NEW
│       │   ├── mapping-submissions.ts       ← NEW
│       │   └── submissions.ts               (existing)
│       └── services/
│           └── spam.ts                      (EXTEND — add mapping checks)
│
├── etl/
│   └── src/
│       ├── builders/
│       │   ├── mapping_builder.py           ← NEW
│       │   └── sqlite_builder.py            (EXTEND — add mapping tables)
│       ├── exporters/
│       │   └── server_exporter.py           ← NEW
│       └── pipeline.py                      (EXTEND — add mapping merge stage)
│
└── ...
```

---

## 14. Migration Strategy

### 14.1 Server Database Migration

Using Drizzle Kit (`npm run db:generate` + `npm run db:migrate`):

**Migration 0002 — Add brand mapping tables:**

```sql
CREATE TABLE brands (...);
CREATE TABLE products (...);
CREATE TABLE brand_mappings (...);
CREATE TABLE product_mappings (...);
CREATE TABLE mapping_images (...);
CREATE TABLE mapping_submissions (...);
-- All indexes
```

This is additive — no existing tables are modified. Zero-downtime migration.

### 14.2 Mobile Database Migration

The embedded SQLite database is rebuilt from scratch by the ETL pipeline. No migration needed — the new tables are added to the schema in `sqlite_builder.py` and created on every build.

For the local Capacitor SQLite database (submission queue, scan history), add an upgrade hook:

```typescript
// apps/mobile/src/composables/useDatabase.ts — extend initialization
async function upgradeLocalDb(db: SQLiteDBConnection) {
  // Check current schema version
  const version = await db.query("SELECT value FROM db_metadata WHERE key = 'local_schema_version'");
  const currentVersion = parseInt(version?.values?.[0]?.value || '1');

  if (currentVersion < 2) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS mapping_submission_queue (
        id                  INTEGER PRIMARY KEY,
        normalized_code     TEXT NOT NULL,
        brand_name          TEXT NOT NULL,
        product_name        TEXT NOT NULL,
        product_image_path  TEXT NOT NULL,
        company_name        TEXT,
        address             TEXT,
        country             TEXT,
        region              TEXT,
        notes               TEXT,
        ocr_confidence      REAL,
        status              TEXT DEFAULT 'pending',
        created_at          TEXT DEFAULT (datetime('now')),
        retry_count         INTEGER DEFAULT 0,
        last_error          TEXT
      );
    `);
    await db.run(
      "INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('local_schema_version', '2')"
    );
  }
}
```

### 14.3 Rollout Order

```text
1. packages/shared    — Add new types + validators (no breaking changes)
2. server             — Add new tables + routes (additive migration)
3. apps/admin         — Add new views + routes (new pages only)
4. etl                — Extend builder + add mapping merge (backward compatible)
5. apps/mobile        — Add new view, composable, extend sync (app update)
```

Each step is independently deployable. No step breaks existing functionality.

---

## 15. Future EU Scaling Strategy

### 15.1 Multi-Language Brand Names

```sql
-- Future: brand name translations
CREATE TABLE brand_names_i18n (
  id        INTEGER PRIMARY KEY,
  brand_id  INTEGER NOT NULL REFERENCES brands(id),
  language  TEXT NOT NULL,           -- ISO 639-1: 'de', 'fr', 'pl'
  name      TEXT NOT NULL,
  is_primary INTEGER DEFAULT 0
);

CREATE INDEX idx_bni_brand ON brand_names_i18n(brand_id);
CREATE INDEX idx_bni_lang ON brand_names_i18n(language);
```

**Example:** "Milka" → same in all languages. "Gut & Günstig" → Germany-specific private label.

### 15.2 Country-Specific Branding

The `brands` table already has a `country` field and `parent_brand_id` for brand hierarchies. This supports:

- **Multi-country brands:** Milka (country = NULL, available everywhere)
- **Private labels per country:** REWE Beste Wahl (country = 'DE'), Boni (country = 'NL')
- **Brand hierarchies:** EDEKA → EDEKA Bio, gut & günstig (parent_brand_id)

### 15.3 Scaling Estimates

| Phase   | Approval Codes | Brand Mappings | Products | Embedded DB Impact |
| ------- | -------------- | -------------- | -------- | ------------------ |
| Phase 1 | ~16K (DE)      | ~500–2K        | ~1K–5K   | < 3 MB total       |
| Phase 2 | ~100K (EU)     | ~10K–50K       | ~20K–100K | < 25 MB total     |
| Phase 3 | ~200K+ (EU)    | ~100K+         | ~200K+   | Switch to sync     |

The embedded SQLite approach remains viable through Phase 2. At Phase 3 scale, brand/product data would move to an online-first model with offline caching (PouchDB/CouchDB sync or similar).

### 15.4 Image Storage Scaling

| Phase   | Images  | Storage          | Strategy                     |
| ------- | ------- | ---------------- | ---------------------------- |
| Phase 1 | ~2K     | ~2 GB            | Local filesystem + backup    |
| Phase 2 | ~50K    | ~50 GB           | S3-compatible object storage |
| Phase 3 | ~200K+  | ~200 GB+         | CDN + S3 + thumbnails        |

Images are **never embedded** in the mobile database. The mobile app displays brand/product text data offline; images are only visible in the admin dashboard (online) or as cached thumbnails if a future "product gallery" feature is added.

---

## 16. Release Workflow Impact

### 16.1 Updated Release Process

```text
EXISTING:
  BVL data → ETL → scanland.db → app build → app store

EXTENDED:
  BVL data ─┐
             ├──► ETL pipeline ──► scanland.db ──► app build ──► app store
  Server DB ─┘    (+ mapping merge)
  (approved
   mappings)
```

### 16.2 Dataset Build Script Extension

```bash
# scripts/build-db.sh — extend

#!/bin/bash
set -e

echo "Building scanland.db with brand mappings..."

# Build base manufacturer data
python etl/src/pipeline.py \
  --source sampledata/ \
  --output apps/mobile/src/assets/db/scanland.db \
  --server-db "${SERVER_DB_PATH:-server/data/scanland.db}" \
  --include-mappings \
  --min-confidence 0.5

# Validate
python scripts/validate-db.sh

echo "Database built successfully."
```

### 16.3 CI/CD Pipeline Extension

```yaml
# .github/workflows/build.yml — extend

- name: Build database with mappings
  run: |
    python etl/src/pipeline.py \
      --source sampledata/ \
      --output apps/mobile/src/assets/db/scanland.db \
      --server-db server/data/scanland.db \
      --include-mappings \
      --min-confidence 0.5

- name: Validate mapping data
  run: |
    python -c "
    import sqlite3
    conn = sqlite3.connect('apps/mobile/src/assets/db/scanland.db')
    brands = conn.execute('SELECT COUNT(*) FROM brands').fetchone()[0]
    mappings = conn.execute('SELECT COUNT(*) FROM brand_mappings').fetchone()[0]
    print(f'Brands: {brands}, Mappings: {mappings}')
    assert brands >= 0, 'Brand count validation failed'
    conn.close()
    "
```

---

## 17. Summary of All Changes

### New Files (11)

| File                                          | Purpose                                |
| --------------------------------------------- | -------------------------------------- |
| `packages/shared/src/types/mapping.ts`        | Brand/product/mapping TypeScript types |
| `packages/shared/src/validators/mapping.validator.ts` | Input validation for mappings  |
| `server/src/routes/mapping-submissions.ts`    | Public submission API endpoint         |
| `server/src/routes/brands.ts`                 | Public brand search endpoint           |
| `server/src/routes/admin-mappings.ts`         | Admin mapping management APIs          |
| `apps/mobile/src/composables/useBrandMapping.ts` | Mobile offline lookup + queue       |
| `apps/mobile/src/views/BrandMappingView.vue`  | Brand/product submission form          |
| `apps/admin/src/views/MappingSubmissionsView.vue` | Admin mapping review queue         |
| `apps/admin/src/views/MappingDetailView.vue`  | Admin single mapping review            |
| `apps/admin/src/views/BrandsView.vue`         | Admin brand management + merge         |
| `apps/admin/src/views/ProductsView.vue`       | Admin product management + merge       |
| `etl/src/builders/mapping_builder.py`         | Merge approved mappings into mobile DB |
| `etl/src/exporters/server_exporter.py`        | Export from server DB for ETL merge    |

### Modified Files (12)

| File                                          | Change                                |
| --------------------------------------------- | ------------------------------------- |
| `server/src/db/schema.ts`                     | Add 6 new tables                      |
| `server/src/index.ts`                         | Register 3 new route modules          |
| `server/src/services/spam.ts`                 | Add `analyzeMappingSubmission()`      |
| `packages/shared/src/index.ts`                | Export new types + validators         |
| `apps/mobile/src/views/ResultView.vue`        | Add mapping prompt section            |
| `apps/mobile/src/views/HistoryView.vue`       | Add "add mapping" badge              |
| `apps/mobile/src/composables/useSync.ts`      | Add `uploadPendingMappings()`         |
| `apps/mobile/src/composables/useDatabase.ts`  | Add local DB upgrade hook             |
| `apps/mobile/src/router/index.ts`             | Add `/brand-mapping` route            |
| `apps/admin/src/router.ts`                    | Add 4 new admin routes                |
| `apps/admin/src/views/AdminLayout.vue`        | Add sidebar nav items                 |
| `apps/admin/src/views/DashboardView.vue`      | Add mapping stats cards               |
| `etl/src/builders/sqlite_builder.py`          | Extend schema with mapping tables     |
| `etl/src/pipeline.py`                         | Add mapping merge stage + CLI flags   |
