<script>
    import {onMount} from 'svelte';
    import navigation from '../../stores/navigation';
    import {Link} from 'svelte-routing';

    const {loading, error} = navigation;

    onMount(async function() {
       await navigation.fetch();
    });
</script>

<style>
    :root {
       --navigatonBackground: #ccc;
       --navigationHeight: 40px;
       --loadingColor: #909090;
       --linkColor: #5399cc;
       --linkColorHovered: #447aa3;
       --errorColor: #e93d5f;
    }

    .loading, .error {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        color: var(--loadingColor);
    }

    .error {
        color: var(--errorColor);
    }

    nav {
        width: 100vw;
        height: var(--navigationHeight);
        background: var(--navigatonBackground);
    }

    ul {
        margin: 0;
        padding: 10px;
        list-style: none;
    }

    ul li {
        display: inline-block;
        margin-left: 10px;
    }

    ul li a {
        color: var(--linkColor)
    }

    ul li a:hover {
        color: var(--linkColorHovered);
    }
</style>

<nav>
    {#if $loading}
        <div class="loading">Loading...</div>
    {:else if $error}
        <div class="error">{$error}</div>
    {:else}
        <ul>
            {#each $navigation as item (item.id)}
                <li>
                    <Link to={item.href} >{item.title}</Link>
                </li>
            {/each}
        </ul>
    {/if}

</nav>
