<script>
	import Layout from './components/layouts/Default.svelte';
    import Home from './components/pages/Home.svelte';
    import Search from './components/pages/Search.svelte';
    import Details from './components/pages/Details.svelte';

    import {Router, Route} from 'svelte-routing';

	let url = '';
</script>

<style>

</style>

<Router url={url}>
    <Layout>
        <Route path="/">
            <Home />
        </Route>
        <Route path="/search">
            <Search />
        </Route>
        <Route path="/details/:id">
            <Details />
        </Route>
    </Layout>
</Router>
