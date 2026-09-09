export type PageSyncFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface PageSyncEnvironment {
	fetch: PageSyncFetch;
	isHidden: () => boolean;
	onVisibilityChange: (listener: () => void) => () => void;
}

export interface PageSynchronizationOptions<T> {
	url: string;
	onValue: (value: T, synchronizedAt: number) => void;
	onStart?: () => void;
	onError?: (message: string) => void;
	environment?: PageSyncEnvironment;
}

function browserEnvironment(): PageSyncEnvironment {
	return {
		fetch: globalThis.fetch.bind(globalThis),
		isHidden: () => document.hidden,
		onVisibilityChange: (listener) => {
			document.addEventListener('visibilitychange', listener);
			return () => document.removeEventListener('visibilitychange', listener);
		}
	};
}

function synchronizationTimestamp(response: Response): number {
	const value = Number(response.headers.get('x-warmify-synchronized-at'));
	return Number.isFinite(value) && value > 0 ? value : Date.now();
}

export function startPageSynchronization<T>(options: PageSynchronizationOptions<T>): () => void {
	const environment = options.environment ?? browserEnvironment();
	let sequence = 0;
	let controller: AbortController | undefined;
	let stopped = false;

	const synchronize = async () => {
		if (stopped || environment.isHidden()) return;
		const requestSequence = ++sequence;
		controller?.abort();
		controller = new AbortController();
		options.onStart?.();
		try {
			const response = await environment.fetch(options.url, {
				headers: { accept: 'application/json' },
				signal: controller.signal
			});
			if (!response.ok) throw new Error('Synchronization failed');
			const value = (await response.json()) as T;
			if (!stopped && requestSequence === sequence) {
				options.onValue(value, synchronizationTimestamp(response));
			}
		} catch (caught) {
			if (
				!stopped &&
				requestSequence === sequence &&
				!(caught instanceof DOMException && caught.name === 'AbortError')
			) {
				options.onError?.('Live synchronization failed.');
			}
		}
	};

	const removeVisibilityListener = environment.onVisibilityChange(() => {
		if (!environment.isHidden()) void synchronize();
	});
	void synchronize();

	return () => {
		stopped = true;
		sequence += 1;
		controller?.abort();
		removeVisibilityListener();
	};
}
