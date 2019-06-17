<script>
    export let item;
    import {Link} from 'svelte-routing';
</script>

<style>
    .is-root {
        width: 100%;
        display: block;
    }

    .is-root ul {
        width: 100%;
        padding: 10px 0;
        margin: 0;
        list-style: none;
    }

    .is-root li {
        display: inline-block;
        margin-left: 10px;
    }
</style>

{#if item}
    {#if item.items }
        <span class:is-root={item.isRoot}>
            {item.title}
            <ul>
                {#each item.items as item (item.id)}
                    <svelte:self item={item}></svelte:self>
                {/each}
            </ul>
        </span>
    {:else}
        <li>
            <Link to={item.href} >{item.title}</Link>
        </li>
    {/if}
{:else}

{/if}

