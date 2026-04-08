import { ref } from 'vue';
import type { Manufacturer, LookupResult } from '@scanland/shared';

/**
 * Database composable — manages SQLite lookups against the embedded manufacturer database.
 *
 * On native (Capacitor), uses @capacitor-community/sqlite.
 * On web (dev mode), falls back to sql.js (WASM SQLite).
 */

let dbReady = false;
let db: any = null;

export function useDatabase() {
	const isReady = ref(dbReady);
	const error = ref<string | null>(null);

	async function initialize(): Promise<void> {
		if (dbReady) return;

		try {
			// Check if running on native platform
			if (isNativePlatform()) {
				await initNativeDb();
			} else {
				await initWebDb();
			}
			dbReady = true;
			isReady.value = true;
		} catch (e: any) {
			error.value = e.message || 'Failed to initialize database';
			console.error('Database init error:', e);
		}
	}

	async function lookupByNormalizedCode(normalizedCode: string): Promise<Manufacturer | null> {
		if (!dbReady || !db) return null;

		try {
			const results = await executeQuery('SELECT * FROM manufacturers WHERE normalized_code = ? LIMIT 1', [normalizedCode]);
			return results.length > 0 ? mapToManufacturer(results[0]) : null;
		} catch (e) {
			console.error('Lookup error:', e);
			return null;
		}
	}

	async function lookupByApprovalNumber(approvalNumber: string, stateCode?: string): Promise<Manufacturer[]> {
		if (!dbReady || !db) return [];

		try {
			let sql: string;
			let params: any[];

			if (stateCode) {
				sql = 'SELECT * FROM manufacturers WHERE approval_number = ? AND state_code = ? LIMIT 10';
				params = [approvalNumber, stateCode];
			} else {
				sql = 'SELECT * FROM manufacturers WHERE approval_number = ? LIMIT 10';
				params = [approvalNumber];
			}

			const results = await executeQuery(sql, params);
			return results.map(mapToManufacturer);
		} catch (e) {
			console.error('Lookup error:', e);
			return [];
		}
	}

	async function searchByText(query: string): Promise<Manufacturer[]> {
		if (!dbReady || !db) return [];

		try {
			const results = await executeQuery(
				`SELECT m.* FROM manufacturers m
         JOIN manufacturers_fts fts ON m.id = fts.rowid
         WHERE manufacturers_fts MATCH ? LIMIT 20`,
				[query + '*']
			);
			return results.map(mapToManufacturer);
		} catch (e) {
			console.error('FTS search error:', e);
			return [];
		}
	}

	async function fuzzyLookup(normalizedCode: string, approvalNumber: string, stateCode?: string, mode?: 'like' | 'prefix'): Promise<Manufacturer[]> {
		if (!dbReady || !db) return [];

		try {
			let sql: string;
			let params: any[];

			if (mode === 'prefix' && stateCode) {
				// Prefix mode: "016" matches "016xx" in the same state
				sql = 'SELECT * FROM manufacturers WHERE state_code = ? AND normalized_code LIKE ? LIMIT 10';
				params = [stateCode, `${stateCode}${approvalNumber}%`];
			} else if (stateCode) {
				// Fuzzy within state
				sql = 'SELECT * FROM manufacturers WHERE state_code = ? AND (normalized_code LIKE ? OR approval_number LIKE ?) LIMIT 10';
				params = [stateCode, `%${approvalNumber}%`, `%${approvalNumber}%`];
			} else {
				// Cross-state fuzzy
				sql = 'SELECT * FROM manufacturers WHERE normalized_code LIKE ? OR approval_number LIKE ? LIMIT 10';
				params = [`%${approvalNumber}%`, `%${approvalNumber}%`];
			}

			const results = await executeQuery(sql, params);
			return results.map(mapToManufacturer);
		} catch (e) {
			console.error('Fuzzy lookup error:', e);
			return [];
		}
	}

	async function getRecordCount(): Promise<number> {
		if (!dbReady || !db) return 0;
		try {
			const results = await executeQuery('SELECT COUNT(*) as count FROM manufacturers', []);
			return results[0]?.count ?? 0;
		} catch {
			return 0;
		}
	}

	return {
		isReady,
		error,
		initialize,
		lookupByNormalizedCode,
		lookupByApprovalNumber,
		searchByText,
		fuzzyLookup,
		getRecordCount,
	};
}

// ---- Internal helpers ----

function isNativePlatform(): boolean {
	return typeof (window as any)?.Capacitor !== 'undefined';
}

async function initNativeDb(): Promise<void> {
	const { CapacitorSQLite } = await import('@capacitor-community/sqlite');

	// Copy pre-populated DB from assets on first launch
	const copyResult = await CapacitorSQLite.copyFromAssets({ overwrite: false });

	// Open the database
	await CapacitorSQLite.open({
		database: 'scanland',
		readonly: true,
	});

	db = CapacitorSQLite;
}

async function initWebDb(): Promise<void> {
	// For web development, use sql.js (WASM SQLite).
	// The DB file is in public/ so Vite serves it as a static file.
	const response = await fetch('/scanland.db');
	if (!response.ok) {
		throw new Error(`Could not load database file (HTTP ${response.status})`);
	}

	const buffer = await response.arrayBuffer();

	// Dynamically import sql.js — use CDN for the WASM file since Vite's SPA
	// history fallback can interfere with serving .wasm from public/
	const initSqlJs = (await import('sql.js')).default;
	const SQL = await initSqlJs({
		locateFile: () => 'https://sql.js.org/dist/sql-wasm.wasm',
	});
	db = new SQL.Database(new Uint8Array(buffer));
}

async function executeQuery(sql: string, params: any[]): Promise<any[]> {
	if (isNativePlatform()) {
		const result = await db.query({
			database: 'scanland',
			statement: sql,
			values: params,
		});
		return result.values || [];
	} else {
		// sql.js
		const stmt = db.prepare(sql);
		stmt.bind(params);
		const rows: any[] = [];
		while (stmt.step()) {
			rows.push(stmt.getAsObject());
		}
		stmt.free();
		return rows;
	}
}

function mapToManufacturer(row: any): Manufacturer {
	return {
		id: row.id,
		stateCode: row.state_code,
		approvalNumber: row.approval_number,
		normalizedCode: row.normalized_code,
		fullCode: row.full_code,
		companyName: row.company_name,
		street: row.street || undefined,
		houseNumber: row.house_number || undefined,
		postalCode: row.postal_code || undefined,
		city: row.city || undefined,
		categories: row.categories ? JSON.parse(row.categories) : undefined,
		restrictions: row.restrictions || undefined,
		remarks: row.remarks || undefined,
		thirdCountryApprovals: row.third_country_approvals || undefined,
		approvalValidUntil: row.approval_valid_until || undefined,
		approvalSuspendedSince: row.approval_suspended_since || undefined,
	};
}
