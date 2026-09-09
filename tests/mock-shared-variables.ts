type Variable = {
	id: number;
	key: string;
	value: string | null;
	comment: string | null;
	is_literal: boolean;
	is_multiline: boolean;
	is_shown_once: boolean;
};
const scopes = new Map<string, Variable[]>();
let sequence = 100;
export async function mockSharedVariables(request: Request, scope: string, id?: string) {
	let rows = scopes.get(scope);
	if (!rows) {
		rows = [
			{
				id: sequence++,
				key: 'BASE_KEY',
				value: scope.includes('/environments/')
					? 'environment-shared-secret'
					: 'project-shared-secret',
				comment: 'Shared fixture',
				is_literal: false,
				is_multiline: false,
				is_shown_once: false
			}
		];
		scopes.set(scope, rows);
	}
	const failure = (message: string, status: number) => Response.json({ message }, { status });
	if (request.method === 'GET')
		return Response.json(
			rows.map((row) => (row.is_shown_once ? { ...row, value: undefined } : row))
		);
	const row = rows.find((entry) => String(entry.id) === id);
	if (id && !row) return failure('Environment variable not found.', 404);
	if (request.method === 'DELETE' && row) {
		scopes.set(
			scope,
			rows.filter((entry) => entry.id !== row.id)
		);
		return failure('Environment variable deleted.', 200);
	}
	const body = (await request.json()) as Record<string, unknown>;
	if (
		Object.keys(body).some(
			(key) =>
				!['key', 'value', 'comment', 'is_literal', 'is_multiline', 'is_shown_once'].includes(key)
		)
	)
		return failure('This field is not allowed.', 422);
	if (typeof body.key !== 'string' || !/^[A-Za-z_][A-Za-z0-9_.]*$/.test(body.key))
		return failure('Invalid key.', 422);
	if (rows.some((entry) => entry.key === body.key && entry.id !== row?.id))
		return failure('Environment variable already exists.', 409);
	if (request.method === 'POST' && !id) {
		const created: Variable = {
			id: sequence++,
			key: body.key,
			value: body.value == null ? null : String(body.value),
			comment: body.comment == null ? null : String(body.comment),
			is_literal: body.is_literal === true,
			is_multiline: body.is_multiline === true,
			is_shown_once: body.is_shown_once === true
		};
		rows.push(created);
		return Response.json({ id: created.id }, { status: 201 });
	}
	if (request.method === 'PATCH' && row) {
		Object.assign(row, body);
		return Response.json(row.is_shown_once ? { ...row, value: undefined } : row);
	}
	return failure('Not found.', 404);
}
