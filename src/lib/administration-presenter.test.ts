import { expect, test } from 'vitest';

import {
	privateKeyCollection,
	privateKeyView,
	teamCollection,
	teamMemberCollection
} from './administration-presenter';

test('private key projection exposes useful metadata but never private material', () => {
	const value = {
		uuid: 'key-1',
		name: 'Production SSH',
		description: 'Main server key',
		private_key: 'private-key-secret',
		public_key: 'ssh-ed25519 public-material',
		fingerprint: 'SHA256:fingerprint',
		is_git_related: true,
		team_id: 1,
		nested: { token: 'nested-secret' }
	};
	const projected = privateKeyView(value);
	expect(projected).toMatchObject({
		uuid: 'key-1',
		name: 'Production SSH',
		publicKey: 'ssh-ed25519 public-material',
		fingerprint: 'SHA256:fingerprint',
		isGitRelated: true
	});
	expect(JSON.stringify(projected)).not.toMatch(/private-key-secret|nested-secret|team_id/);
	expect(privateKeyCollection([value, { name: 'missing uuid' }])).toHaveLength(1);
});

test('team and member projections use numeric identities and explicit fields', () => {
	const teams = teamCollection([
		{
			id: 1,
			name: 'Root Team',
			description: 'Primary',
			personal_team: false,
			custom_server_limit: 99
		},
		{ id: 'bad', name: 'Invalid' }
	]);
	const members = teamMemberCollection([
		{
			id: 7,
			name: 'Admin',
			email: 'admin@example.test',
			email_verified_at: '2026-09-07T00:00:00Z',
			two_factor_confirmed_at: '2026-09-07T00:00:00Z',
			force_password_reset: false,
			password: 'secret',
			pivot: { role: 'owner' },
			email_change_code: 'secret-code'
		}
	]);
	expect(teams).toEqual([
		expect.objectContaining({ id: '1', name: 'Root Team', personalTeam: false })
	]);
	expect(members).toEqual([
		expect.objectContaining({
			id: '7',
			name: 'Admin',
			email: 'admin@example.test',
			twoFactorEnabled: true
		})
	]);
	expect(JSON.stringify({ teams, members })).not.toMatch(
		/custom_server_limit|secret-code|password|pivot/
	);
});
