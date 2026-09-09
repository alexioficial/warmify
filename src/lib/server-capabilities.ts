export interface ServerCapability {
	name: string;
	status: 'Available' | 'Development only' | 'No public API';
	detail: string;
	href?: string;
}

export const serverCapabilities: readonly ServerCapability[] = [
	{
		name: 'General settings and validation',
		status: 'Available',
		detail: 'Connection settings, validation, resources, domains and shared variables.',
		href: 'general'
	},
	{
		name: 'Docker and observability settings',
		status: 'Available',
		detail: 'Destinations, cleanup, proxy, tunnel, Sentinel and log-drain public endpoints.',
		href: 'destinations'
	},
	{
		name: 'Transfer, migration and mailbox export',
		status: 'Development only',
		detail:
			'Coolify returns 404 for these public routes unless the instance itself is running in development mode.'
	},
	{
		name: 'CA certificate and Swarm administration',
		status: 'No public API',
		detail: 'The pinned public API has no equivalent for the Coolify sidebar screens.'
	},
	{
		name: 'Terminal, terminal access and server patching',
		status: 'No public API',
		detail: 'Warmify does not call Coolify Livewire or other private endpoints.'
	},
	{
		name: 'Metrics, proxy logs and Sentinel logs',
		status: 'No public API',
		detail: 'Configuration endpoints do not provide these log streams or chart data.'
	}
] as const;
