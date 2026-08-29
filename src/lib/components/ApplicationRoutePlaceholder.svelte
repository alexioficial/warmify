<script lang="ts">
	let { title, description }: { title: string; description: string } = $props();
</script>

<section>
	<h2>{title}</h2>
	<p>{description}</p>
	<p class="muted">This route is ready for its documented Coolify API workflow.</p>
</section>
