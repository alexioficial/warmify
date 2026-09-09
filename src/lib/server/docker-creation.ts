import { error, fail, isHttpError, isRedirect, redirect, type RequestEvent } from '@sveltejs/kit';
import { asRecord, firstText } from '../resource-presenter';
import { CoolifyError } from './coolify-client';
import { invalidateCollection } from './inventory-cache';
import { loadHierarchy } from './project-actions';
import { configurationSubmission } from './resource-actions';
import type { ConfigurationField } from './resource-groups';
import { audit, getCoolifyClient } from './runtime';

export const dockerCreationKinds = new Set(['dockerfile', 'docker-image', 'docker-compose']);
export function dockerCreationFields(kind: string): ConfigurationField[] {
	if (!dockerCreationKinds.has(kind)) return [];
	return [
		{ name: 'server_uuid', label: 'Server', section: 'Destination' },
		{ name: 'destination_uuid', label: 'Destination', section: 'Destination' },
		{ name: 'name', label: 'Name', section: 'General' },
		{ name: 'description', label: 'Description', type: 'textarea', section: 'General' },
		...(kind === 'docker-image'
			? [
					{ name: 'docker_registry_image_name', label: 'Image name', section: 'Docker image' },
					{ name: 'docker_registry_image_tag', label: 'Tag', section: 'Docker image' },
					{ name: 'digest', label: 'SHA256 digest', section: 'Docker image' },
					{ name: 'ports_exposes', label: 'Exposed ports', section: 'Networking' }
				]
			: [
					{
						name: kind === 'dockerfile' ? 'dockerfile' : 'docker_compose_raw',
						label: kind === 'dockerfile' ? 'Dockerfile content' : 'Docker Compose file',
						type: 'textarea' as const,
						coerce: 'base64' as const,
						sensitive: true,
						section: 'Source'
					}
				]),
		...(kind === 'docker-compose'
			? []
			: [
					{ name: 'domains', label: 'Domains', section: 'Networking' },
					{
						name: 'autogenerate_domain',
						label: 'Generate a domain when blank',
						type: 'checkbox' as const,
						coerce: 'boolean' as const,
						section: 'Networking'
					}
				]),
		{
			name: 'instant_deploy',
			label: 'Deploy immediately',
			type: 'checkbox',
			coerce: 'boolean',
			section: 'Create'
		}
	];
}
export function dockerCreationSubmission(form: FormData, kind: string) {
	const fields = dockerCreationFields(kind);
	const supplied = new FormData();
	for (const field of fields) {
		const value = form.getAll(field.name).at(-1);
		if (value != null && String(value).trim() !== '') supplied.set(field.name, value);
	}
	const result = configurationSubmission(supplied, fields);
	const { body, values, fieldErrors } = result;
	if (!body.server_uuid) fieldErrors.server_uuid = 'Select a server.';
	if (String(body.name ?? '').length > 255) fieldErrors.name = 'Use at most 255 characters.';
	if (kind === 'dockerfile' || kind === 'docker-compose') {
		const key = kind === 'dockerfile' ? 'dockerfile' : 'docker_compose_raw';
		if (!body[key]) fieldErrors[key] = 'Enter the source document.';
	}
	if (kind === 'docker-image') {
		const image = String(body.docker_registry_image_name ?? '');
		const tag = String(body.docker_registry_image_tag ?? '');
		const digest = String(body.digest ?? '');
		delete body.digest;
		const embeddedDigest = /@sha256:([a-f0-9]{64})$/i.exec(image);
		const hasTag = !embeddedDigest && image.lastIndexOf(':') > image.lastIndexOf('/');
		const name = embeddedDigest
			? image.slice(0, embeddedDigest.index)
			: hasTag
				? image.slice(0, image.lastIndexOf(':'))
				: image;
		const embeddedTag = hasTag ? image.slice(image.lastIndexOf(':') + 1) : '';
		const validName =
			/^(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[0-9]+)?\/)?[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*(?:\/[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*)*$/;
		const validTag = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;
		if (
			!image ||
			image.length > 255 ||
			!validName.test(name) ||
			(hasTag && !validTag.test(embeddedTag))
		)
			fieldErrors.docker_registry_image_name = 'Use an image name, image:tag or image@sha256:hash.';
		if (tag && (!validTag.test(tag) || hasTag || embeddedDigest || digest))
			fieldErrors.docker_registry_image_tag =
				'Use a valid tag only with an untagged image and no digest.';
		if (digest && (!/^[a-f0-9]{64}$/i.test(digest) || hasTag || embeddedDigest || tag))
			fieldErrors.digest = 'Use 64 hexadecimal characters with an untagged image and no tag.';
		if (digest && !fieldErrors.digest)
			body.docker_registry_image_name = `${image}@sha256:${digest}`;
		const ports = String(body.ports_exposes ?? '');
		if (
			ports &&
			(!/^\d+(,\d+)*$/.test(ports) ||
				ports.split(',').some((port) => Number(port) < 1 || Number(port) > 65535))
		)
			fieldErrors.ports_exposes = 'Use comma-separated ports between 1 and 65535.';
	}
	return { ...result, values };
}
export async function createDockerResource(event: RequestEvent) {
	const kind = event.params.kind!;
	let values: Record<string, string | boolean> = {};
	const started = Date.now();
	try {
		if (!event.locals.user) error(401, 'Authentication required.');
		if (event.request.headers.get('origin') !== event.url.origin)
			error(403, 'Same-origin request required.');
		if (!dockerCreationKinds.has(kind)) error(404, 'Unsupported resource type.');
		const submission = dockerCreationSubmission(await event.request.formData(), kind);
		values = submission.values;
		if (Object.keys(submission.fieldErrors).length)
			return fail(400, {
				error: 'Correct the highlighted fields.',
				values,
				fieldErrors: submission.fieldErrors
			});
		const context = await loadHierarchy(event);
		if (context.kind !== 'environment') error(404, 'Environment required.');
		const group = kind === 'docker-compose' ? 'services' : 'applications';
		const path =
			kind === 'docker-compose'
				? '/services'
				: `/applications/${kind === 'dockerfile' ? 'dockerfile' : 'dockerimage'}`;
		const result = await getCoolifyClient().request('POST', path, {
			body: {
				...submission.body,
				project_uuid: event.params.uuid,
				environment_uuid: context.uuid
			}
		});
		for (const key of [group, 'projects', 'resources']) invalidateCollection(key);
		audit({
			user: event.locals.user.username,
			operation: `create-${kind}`,
			result: 'success',
			duration_ms: Date.now() - started
		});
		const uuid = firstText(asRecord(result), ['uuid']);
		redirect(303, uuid ? `/${group}/${encodeURIComponent(uuid)}/general` : context.href);
	} catch (caught) {
		if (isRedirect(caught)) throw caught;
		const candidate = caught instanceof CoolifyError || isHttpError(caught) ? caught.status : 500;
		const status = candidate >= 400 && candidate <= 599 ? candidate : 500;
		const fieldErrors: Record<string, string> = {};
		const upstream =
			caught instanceof CoolifyError ? asRecord(asRecord(caught.details)?.errors) : undefined;
		for (const field of dockerCreationFields(kind))
			if (upstream && field.name in upstream)
				fieldErrors[field.name] = 'Coolify rejected this value.';
		// Parsers may echo fragments of Dockerfile/Compose content, not just whole values.
		// Do not serialize upstream messages, details or source documents into action data.
		const message = isHttpError(caught)
			? caught.body.message
			: status === 422 || status === 400
				? 'Coolify rejected the configuration. Review the fields and re-enter source documents.'
				: status === 404
					? 'Project, environment, server or destination not found.'
					: status === 409
						? 'The resource configuration conflicts with an existing resource.'
						: 'The creation request could not be completed. Check the environment before retrying.';
		audit({
			user: event.locals.user?.username,
			operation: `create-${kind}`,
			result: 'error',
			duration_ms: Date.now() - started
		});
		return fail(status, { error: message, values, fieldErrors });
	}
}
