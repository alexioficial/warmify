import { normalizeRecords, type ResourceRecord } from '$lib/resource-presenter';
import { deleteCache, readCache, writeCache } from '$lib/server/cache-database';
import { loadProjectCollection } from '$lib/server/project-collection';
import { redactSecrets } from '$lib/server/redact';
import { resourceGroups } from '$lib/server/resource-groups';
import { getCoolifyClient } from '$lib/server/runtime';
import { deploymentCollection } from '$lib/server/deployment-presenter';

const PROJECTS_KEY = 'collection:projects';
const DASHBOARD_KEY = 'dashboard';
const RECENT_SYNC_MS = 5_000;
export const CACHE_STALE_MS = 5 * 60_000;

export interface CacheSnapshot<T> {
	value: T;
	updatedAt: number;
	fromCache: boolean;
	stale: boolean;
}

export interface DashboardSnapshot {
	projects: ResourceRecord[];
	servers: unknown;
	deployments: unknown;
	version: unknown;
}

const activeSynchronizations = new Map<string, Promise<unknown>>();
const cacheGenerations = new Map<string, number>();

function collectionKey(groupName: string): string {
	return groupName === 'projects' ? PROJECTS_KEY : `collection:${groupName}`;
}

function synchronizeCached<T>(key: string, force: boolean, refresh: () => Promise<T>): Promise<T> {
	const cached = readCache<T>(key);
	if (!force && cached && Date.now() - cached.updatedAt < RECENT_SYNC_MS) {
		return Promise.resolve(cached.value);
	}
	const active = activeSynchronizations.get(key);
	if (active) return active as Promise<T>;

	const generation = cacheGenerations.get(key) ?? 0;
	const synchronization = refresh()
		.then((value) => {
			if ((cacheGenerations.get(key) ?? 0) === generation) writeCache(key, value);
			return value;
		})
		.finally(() => {
			if (activeSynchronizations.get(key) === synchronization) {
				activeSynchronizations.delete(key);
			}
		});
	activeSynchronizations.set(key, synchronization);
	return synchronization;
}

function invalidateKey(key: string): void {
	cacheGenerations.set(key, (cacheGenerations.get(key) ?? 0) + 1);
	activeSynchronizations.delete(key);
	deleteCache(key);
}

export function synchronizeProjects(force = false): Promise<ResourceRecord[]> {
	return synchronizeCached(PROJECTS_KEY, force, async () =>
		normalizeRecords(redactSecrets(await loadProjectCollection(getCoolifyClient())))
	);
}

export function synchronizeCollection(groupName: string, force = false): Promise<unknown> {
	if (groupName === 'projects') return synchronizeProjects(force);
	const group = resourceGroups[groupName];
	if (!group) return Promise.reject(new Error('Resource group is not cacheable'));
	return synchronizeCached(collectionKey(groupName), force, async () => {
		if (groupName === 'sources') {
			const [github, gitlab] = await Promise.all([
				getCoolifyClient().request('GET', '/github-apps'),
				getCoolifyClient().request('GET', '/gitlab-apps')
			]);
			return [
				...normalizeRecords(redactSecrets(github)).map((source) => ({
					...source,
					provider: 'github'
				})),
				...normalizeRecords(redactSecrets(gitlab)).map((source) => ({
					...source,
					provider: 'gitlab'
				}))
			];
		}
		const value = await getCoolifyClient().request('GET', group.listPath);
		return groupName === 'deployments' ? deploymentCollection(value) : redactSecrets(value);
	});
}

function snapshot<T>(value: T, updatedAt: number, fromCache: boolean): CacheSnapshot<T> {
	return {
		value,
		updatedAt,
		fromCache,
		stale: Date.now() - updatedAt > CACHE_STALE_MS
	};
}

export async function synchronizeCollectionSnapshot(
	groupName: string,
	force = true
): Promise<CacheSnapshot<unknown>> {
	const value = await synchronizeCollection(groupName, force);
	const cached = readCache<unknown>(collectionKey(groupName));
	return snapshot(value, cached?.updatedAt ?? Date.now(), false);
}

export async function collectionSnapshotForPage(
	groupName: string
): Promise<CacheSnapshot<unknown>> {
	const cached = readCache<unknown>(collectionKey(groupName));
	if (!cached) return synchronizeCollectionSnapshot(groupName, true);
	void synchronizeCollection(groupName, true).catch(() => undefined);
	return snapshot(cached.value, cached.updatedAt, true);
}

export async function collectionForPage(groupName: string): Promise<unknown> {
	return (await collectionSnapshotForPage(groupName)).value;
}

export function invalidateCollection(groupName: string): void {
	invalidateKey(collectionKey(groupName));
	if (['projects', 'servers', 'deployments', 'system'].includes(groupName)) {
		invalidateKey(DASHBOARD_KEY);
	}
}

export function invalidateAllCollections(): void {
	for (const groupName of Object.keys(resourceGroups)) invalidateKey(collectionKey(groupName));
	invalidateKey(DASHBOARD_KEY);
}

function primeMissingCollections(): void {
	for (const groupName of Object.keys(resourceGroups)) {
		if (readCache(collectionKey(groupName))) continue;
		void synchronizeCollection(groupName).catch(() => undefined);
	}
}

export function synchronizeDashboard(force = false): Promise<DashboardSnapshot> {
	return synchronizeCached(DASHBOARD_KEY, force, async () => {
		const [projects, servers, deployments, version] = await Promise.all([
			synchronizeCollection('projects', force),
			synchronizeCollection('servers', force),
			synchronizeCollection('deployments', force),
			synchronizeCollection('system', force)
		]);
		return {
			projects: normalizeRecords(projects),
			servers,
			deployments,
			version
		};
	});
}

export async function synchronizeDashboardSnapshot(
	force = true
): Promise<CacheSnapshot<DashboardSnapshot>> {
	const value = await synchronizeDashboard(force);
	const cached = readCache<DashboardSnapshot>(DASHBOARD_KEY);
	return snapshot(value, cached?.updatedAt ?? Date.now(), false);
}

export async function dashboardSnapshotForPage(): Promise<CacheSnapshot<DashboardSnapshot>> {
	const cached = readCache<DashboardSnapshot>(DASHBOARD_KEY);
	if (!cached) {
		const current = await synchronizeDashboardSnapshot(true);
		primeMissingCollections();
		return current;
	}
	void synchronizeDashboard(true).catch(() => undefined);
	primeMissingCollections();
	return snapshot(cached.value, cached.updatedAt, true);
}

export async function dashboardForPage(): Promise<DashboardSnapshot> {
	return (await dashboardSnapshotForPage()).value;
}
