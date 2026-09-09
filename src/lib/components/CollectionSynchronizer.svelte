<script lang="ts">
	import { onMount } from 'svelte';
	import { startPageSynchronization } from '$lib/client/page-sync';
	import CacheSyncStatus from '$lib/components/CacheSyncStatus.svelte';

	let {
		url,
		onValue,
		initialUpdatedAt,
		initialStale = false
	}: {
		url: string;
		onValue: (value: unknown) => void;
		initialUpdatedAt?: number;
		initialStale?: boolean;
	} = $props();

	let updatedAt = $state<number>();
	let stale = $state(false);
	let syncing = $state(false);
	let syncError = $state('');

	$effect(() => {
		updatedAt = initialUpdatedAt;
		stale = initialStale;
	});

	onMount(() =>
		startPageSynchronization({
			url,
			onStart: () => {
				syncing = true;
				syncError = '';
			},
			onValue: (value, synchronizedAt) => {
				onValue(value);
				updatedAt = synchronizedAt;
				stale = false;
				syncing = false;
			},
			onError: (message) => {
				syncError = message;
				syncing = false;
			}
		})
	);
</script>

<CacheSyncStatus {updatedAt} {syncing} {stale} error={syncError} />
