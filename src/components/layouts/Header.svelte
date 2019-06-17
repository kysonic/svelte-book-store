<script>
    import {onMount} from 'svelte';
    import navigation from '../../stores/navigation';
    import HeaderLink  from './HeaderLink.svelte';

    const {loading, error} = navigation;

    onMount(async function() {
       await navigation.fetch();
    });

    $: root = {title: '', items: $navigation, isRoot: true};
</script>

<style>
    :root {
       --navigatonBackground: #ccc;
       --navigationHeight: 40px;
       --loadingColor: #909090;
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
</style>

<nav>
    {#if $loading}
        <div class="loading">Loading...</div>
    {:else if $error}
        <div class="error">{$error}</div>
    {:else}
        <HeaderLink item={root} />
    {/if}

</nav>
