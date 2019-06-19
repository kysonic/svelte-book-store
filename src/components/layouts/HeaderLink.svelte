<script>
    export let item;
    import {Link} from 'svelte-routing';
</script>

<style>
    :root {
        --itemMarginLeft: 10px;
        --dropDownBackgroundColor: #dbdbdb;
    }

    span.is-root {
        width: 100%;
        display: block;
    }

    span.is-root > ul {
        width: 100%;
        padding: 10px 0;
        margin: 0;
        list-style: none;
    }

    :global(span.HeaderLink.is-root li, span.HeaderLink.is-root span) {
        position: relative;
        display: inline-block;
        margin-left: var(--itemMarginLeft);
        cursor: pointer;
    }

    span:not(.is-root) ul {
        position: absolute;
        list-style: none;
        margin: 0;
        padding: 0;
        display: none;
    }

    span:hover:not(.is-root) ul {
        display: block;
        background: var(--dropDownBackgroundColor);
    }

    :global(span.HeaderLink:hover:not(.is-root) ul li) {
        padding: 5px;
        margin: 0;
    }

</style>

{#if item}
    {#if item.items }
        <span class:is-root={item.isRoot} class="HeaderLink">
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
    <span></span>
{/if}

