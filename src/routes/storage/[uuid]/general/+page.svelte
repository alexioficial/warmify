<script lang="ts">
	import { onMount } from 'svelte';

	let { data } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<section class="settings-section">
	<div class="section-heading">
		<div>
			<h2>General</h2>
			<p class="muted">Connection and bucket settings.</p>
		</div>
		<span
			class:status-running={data.storage.isUsable}
			class:status-failed={!data.storage.isUsable}
			class="status">{data.storage.isUsable ? 'Usable' : 'Needs validation'}</span
		>
	</div>
	<form method="POST" action="?/update">
		<div class="form-grid">
			<label
				>Name<input
					name="name"
					minlength="3"
					maxlength="255"
					required
					value={data.storage.name}
					disabled={!ready}
				/></label
			>
			<label
				>Region<input
					name="region"
					maxlength="255"
					required
					value={data.storage.region}
					disabled={!ready}
				/></label
			>
			<label class="wide"
				>Endpoint<input
					name="endpoint"
					type="url"
					maxlength="255"
					required
					value={data.storage.endpoint}
					disabled={!ready}
				/></label
			>
			<label
				>Bucket<input
					name="bucket"
					minlength="3"
					maxlength="63"
					required
					value={data.storage.bucket}
					disabled={!ready}
				/></label
			>
			<label
				>Replace access key<input
					name="key"
					type="password"
					maxlength="255"
					autocomplete="new-password"
					placeholder="Leave blank to keep current"
					disabled={!ready}
				/></label
			>
			<label
				>Replace secret key<input
					name="secret"
					type="password"
					maxlength="255"
					autocomplete="new-password"
					placeholder="Leave blank to keep current"
					disabled={!ready}
				/></label
			>
			<label class="wide"
				>Description<input
					name="description"
					maxlength="255"
					value={data.storage.description}
					disabled={!ready}
				/></label
			>
		</div>
		<p class="muted">
			Changing connection settings marks the destination unvalidated until the next connection test.
		</p>
		<button class="primary" disabled={!ready}>Save storage</button>
	</form>
	<form method="POST" action="?/validate" class="actions">
		<button disabled={!ready}>Validate connection</button>
		<span class="muted"
			>Coolify tests access with S3 ListObjectsV2 and updates the usable status.</span
		>
	</form>
</section>
