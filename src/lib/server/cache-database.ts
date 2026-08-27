import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { getConfig } from '$lib/server/runtime';

interface CacheRow {
	value: string;
	updated_at: number;
}

export interface CacheEntry<T> {
	value: T;
	updatedAt: number;
}

let database: Database.Database | undefined;

function getDatabase(): Database.Database {
	if (database) return database;
	const directory = resolve(getConfig().dataDir);
	mkdirSync(directory, { recursive: true });
	database = new Database(resolve(directory, 'warmify.sqlite'));
	database.pragma('journal_mode = WAL');
	database.exec(`
		CREATE TABLE IF NOT EXISTS cache_entries (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			updated_at INTEGER NOT NULL
		)
	`);
	return database;
}

export function readCache<T>(key: string): CacheEntry<T> | undefined {
	const row = getDatabase()
		.prepare('SELECT value, updated_at FROM cache_entries WHERE key = ?')
		.get(key) as CacheRow | null;
	if (!row) return undefined;
	try {
		return { value: JSON.parse(row.value) as T, updatedAt: row.updated_at };
	} catch {
		getDatabase().prepare('DELETE FROM cache_entries WHERE key = ?').run(key);
		return undefined;
	}
}

export function writeCache(key: string, value: unknown): void {
	getDatabase()
		.prepare(
			`INSERT INTO cache_entries (key, value, updated_at)
			 VALUES (?, ?, ?)
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
		)
		.run(key, JSON.stringify(value), Date.now());
}

export function deleteCache(key: string): void {
	getDatabase().prepare('DELETE FROM cache_entries WHERE key = ?').run(key);
}
