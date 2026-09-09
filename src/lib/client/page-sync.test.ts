import { expect, test, vi } from 'vitest';

import { startPageSynchronization, type PageSyncEnvironment } from './page-sync';

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

function response(value: unknown, synchronizedAt: number) {
	return {
		ok: true,
		json: async () => value,
		headers: new Headers({ 'x-warmify-synchronized-at': String(synchronizedAt) })
	} as Response;
}

test('ignores an older response when a newer visible refresh finishes first', async () => {
	const first = deferred<Response>();
	const second = deferred<Response>();
	const fetcher = vi
		.fn()
		.mockImplementationOnce(() => first.promise)
		.mockImplementationOnce(() => second.promise);
	let visibilityListener: () => void = () => undefined;
	const environment: PageSyncEnvironment = {
		fetch: fetcher,
		isHidden: () => false,
		onVisibilityChange: (listener) => {
			visibilityListener = listener;
			return () => undefined;
		}
	};
	const received: Array<{ value: unknown; synchronizedAt: number }> = [];

	const stop = startPageSynchronization({
		url: '/internal/poll/dashboard',
		environment,
		onValue: (value, synchronizedAt) => received.push({ value, synchronizedAt })
	});
	visibilityListener();
	second.resolve(response({ source: 'new' }, 2));
	await Promise.resolve();
	await Promise.resolve();
	first.resolve(response({ source: 'old' }, 1));
	await Promise.resolve();
	await Promise.resolve();

	expect(received).toEqual([{ value: { source: 'new' }, synchronizedAt: 2 }]);
	expect(fetcher).toHaveBeenCalledTimes(2);
	stop();
});

test('waits for visibility before synchronizing and removes the listener on cleanup', async () => {
	let hidden = true;
	let visibilityListener: () => void = () => undefined;
	const remove = vi.fn();
	const fetcher = vi.fn().mockResolvedValue(response([], 7));
	const environment: PageSyncEnvironment = {
		fetch: fetcher,
		isHidden: () => hidden,
		onVisibilityChange: (listener) => {
			visibilityListener = listener;
			return remove;
		}
	};

	const stop = startPageSynchronization({ url: '/sync', environment, onValue: vi.fn() });
	expect(fetcher).not.toHaveBeenCalled();
	hidden = false;
	visibilityListener();
	await Promise.resolve();
	expect(fetcher).toHaveBeenCalledTimes(1);
	stop();
	expect(remove).toHaveBeenCalledOnce();
});

test('reports a current synchronization failure without surfacing aborts', async () => {
	const onError = vi.fn();
	const environment: PageSyncEnvironment = {
		fetch: vi.fn().mockRejectedValue(new Error('offline')),
		isHidden: () => false,
		onVisibilityChange: () => () => undefined
	};

	const stop = startPageSynchronization({ url: '/sync', environment, onValue: vi.fn(), onError });
	await Promise.resolve();
	await Promise.resolve();
	expect(onError).toHaveBeenCalledWith('Live synchronization failed.');
	stop();
});
