import { asRecord, firstText, normalizeRecords } from '../resource-presenter';

export interface ServiceDomainRow {
	name: string;
	label: string;
	url: string;
}

export function serviceDomainRows(service: unknown): ServiceDomainRow[] {
	return normalizeRecords(asRecord(service)?.applications)
		.map((app) => ({
			name: firstText(app, ['name']),
			label: firstText(app, ['human_name', 'name']),
			url: firstText(app, ['fqdn', 'url'])
		}))
		.filter((row) => Boolean(row.name));
}

export function serviceOverview(service: unknown) {
	const record = asRecord(service);
	const destination = asRecord(record?.destination);
	const links = serviceDomainRows(service).flatMap((row) =>
		row.url.split(',').flatMap((value) => {
			try {
				const url = new URL(value.trim());
				if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return [];
				return [{ name: row.label, url: url.href }];
			} catch {
				return [];
			}
		})
	);
	return {
		type: firstText(record, ['service_type', 'type']) || 'Docker Compose',
		destination: firstText(destination, ['name']) || 'Not provided by Coolify',
		server:
			firstText(asRecord(destination?.server) ?? asRecord(record?.server), ['name']) ||
			'Not provided by Coolify',
		applications: normalizeRecords(record?.applications).length,
		databases: normalizeRecords(record?.databases).length,
		links
	};
}

export function serviceDomainSubmission(form: FormData, service: unknown) {
	const available = serviceDomainRows(service);
	const names = form.getAll('name').map(String);
	const urls = form.getAll('url').map(String);
	const rows = names.map((name, index) => ({
		name,
		label: available.find((row) => row.name === name)?.label ?? name,
		url: (urls[index] ?? '').trim()
	}));
	const rowErrors: Record<number, string> = {};
	const seen = new Set<string>();
	rows.forEach((row, index) => {
		if (!available.some((app) => app.name === row.name) || names.indexOf(row.name) !== index) {
			rowErrors[index] = 'Choose a unique application belonging to this service.';
		}
		for (const value of row.url
			.split(',')
			.map((url) => url.trim())
			.filter(Boolean)) {
			try {
				const parsed = new URL(value);
				if (
					!['http:', 'https:'].includes(parsed.protocol) ||
					parsed.username ||
					parsed.password ||
					/[\s`$;&|<>\\]/.test(value)
				)
					throw new Error();
				if (seen.has(value.toLowerCase()))
					rowErrors[index] = 'This URL is already assigned in this form.';
				seen.add(value.toLowerCase());
			} catch {
				rowErrors[index] = 'Use comma-separated HTTP(S) URLs without credentials.';
			}
		}
	});
	const body =
		rows.length && urls.length === names.length && !Object.keys(rowErrors).length
			? {
					urls: rows.map(({ name, url }) => ({ name, url })),
					...(form.get('confirmation') === 'override domains'
						? { force_domain_override: true as const }
						: {})
				}
			: undefined;
	return { body, rows, rowErrors };
}

export function serviceVariableBody(body: object): Record<string, unknown> {
	const fields = new Set([
		'key',
		'value',
		'is_literal',
		'is_multiline',
		'is_shown_once',
		'comment'
	]);
	return Object.fromEntries(Object.entries(body).filter(([key]) => fields.has(key)));
}

function flag(form: FormData, name: string, fallback: boolean) {
	return form.has(name) ? ['true', '1', 'on'].includes(String(form.getAll(name).at(-1))) : fallback;
}

export function serviceOperationBody(
	operation: 'clone' | 'move' | 'migrate',
	form: FormData
): Record<string, unknown> {
	if (operation === 'move') {
		const environment = String(form.get('environment_uuid') ?? '').trim();
		if (!environment) throw new Error('Choose an environment.');
		return { environment_uuid: environment };
	}
	const destination = String(form.get('destination_uuid') ?? '').trim();
	if (!destination) throw new Error('Choose a destination.');
	if (operation === 'migrate')
		return { destination_uuid: destination, migrate_volumes: flag(form, 'migrate_volumes', true) };
	const name = String(form.get('name') ?? '').trim();
	return {
		destination_uuid: destination,
		...(name ? { name } : {}),
		clone_volumes: flag(form, 'clone_volumes', false)
	};
}
