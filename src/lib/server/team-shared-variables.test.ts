import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const request = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({ invalidateCollection: vi.fn() }));

import {
	loadTeamSharedVariables,
	revealTeamSharedVariable,
	teamSharedVariableActions
} from './shared-variables';

const team = { id: 1, name: 'Root Team', description: 'Primary' };
const variable = {
	id: 7,
	key: 'REGISTRY_TOKEN',
	value: 'stored-team-secret',
	comment: 'Shared',
	is_literal: false,
	is_multiline: false,
	is_shown_once: false
};

function event(values: Record<string, string>, json = false, teamId = '1') {
	const form = new FormData();
	for (const [name, value] of Object.entries(values)) form.set(name, value);
	return {
		params: { uuid: teamId },
		locals: { user: { username: 'admin' } },
		setHeaders: vi.fn(),
		url: new URL(`http://localhost/teams/${teamId}/shared-variables`),
		request: new Request(`http://localhost/teams/${teamId}/shared-variables`, {
			method: 'POST',
			headers: {
				origin: 'http://localhost',
				...(json ? { 'content-type': 'application/json' } : {})
			},
			body: json ? JSON.stringify(values) : form
		})
	} as unknown as RequestEvent;
}

beforeEach(() => request.mockReset());

test('team shared-variable load verifies the current team and strips values', async () => {
	request.mockResolvedValueOnce(team).mockResolvedValueOnce([variable]);
	const result = await loadTeamSharedVariables(event({}));
	expect(result.team).toMatchObject({ id: '1', name: 'Root Team' });
	expect(result.variables).toEqual([expect.objectContaining({ id: '7', key: 'REGISTRY_TOKEN' })]);
	expect(result.revealHref).toBe('/teams/1/shared-variables/reveal');
	expect(JSON.stringify(result)).not.toContain('stored-team-secret');
	expect(request).toHaveBeenNthCalledWith(1, 'GET', '/team');
	expect(request).toHaveBeenNthCalledWith(2, 'GET', '/team/envs');
});

test('team create uses only the current-team endpoint and exact variable fields', async () => {
	request.mockResolvedValueOnce(team).mockResolvedValueOnce({ id: 8 });
	const result = await teamSharedVariableActions.createVariable(
		event({ key: 'REGISTRY_TOKEN', value: 'submitted-team-secret', forged: 'ignored' })
	);
	expect(request).toHaveBeenLastCalledWith('POST', '/team/envs', {
		body: {
			key: 'REGISTRY_TOKEN',
			value: 'submitted-team-secret',
			comment: null,
			is_literal: false,
			is_multiline: false,
			is_shown_once: false
		}
	});
	expect(JSON.stringify(result)).not.toContain('submitted-team-secret');
});

test('foreign team routes fail before any shared-variable mutation', async () => {
	request.mockResolvedValueOnce(team);
	const result = await teamSharedVariableActions.createVariable(
		event({ key: 'KEY', value: 'secret' }, false, '2')
	);
	expect(result).toMatchObject({ status: 404 });
	expect(request).toHaveBeenCalledTimes(1);
});

test('team reveal returns only one current-scope value with no-store', async () => {
	request.mockResolvedValueOnce(team).mockResolvedValueOnce([variable]);
	const response = await revealTeamSharedVariable(event({ id: '7' }, true));
	expect(response.headers.get('cache-control')).toBe('no-store');
	expect(await response.json()).toEqual({ value: 'stored-team-secret' });
});
