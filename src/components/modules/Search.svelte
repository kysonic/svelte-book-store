<script>
    import {Link} from 'svelte-routing';
    import books from '../../stores/books';
    const {loading, error} = books;

    let query = '';

    function search() {
        books.search(query);
    }

    function viewDetails() {

    }
</script>

<style>
    form {
        padding: 10px;
    }

    form input[type = "search"] {
        width: 300px;
        height: 40px;
        border: 1px solid #bec2cc;
        padding: 5px 10px;
        outline: none;
    }

    form input[type = "search"]:focus {
        border: 1px solid #b6b9c8;
    }

    form input[type = "submit"] {
        height: 40px;
        padding: 10px;
        text-transform: uppercase;
        outline: none;
    }

    form input[type = "submit"]:hover {
        background: #f1f5fb;
        cursor: pointer;
    }

    h2 {
        padding: 10px;
    }

    table {
        padding: 20px 0;
        width: 100%;
        height: auto;
        border-spacing: 0;
    }

    table thead tr th, table tbody tr td {
        text-align: left;
    }

    table thead tr th {
        padding: 10px 0 10px 10px;
        background: #f8fae4;
    }

    table tbody tr td {
        padding: 5px 0 5px 10px;
    }

    table tbody tr:nth-child(2n) {
        background: #ecf5f2;
    }

    .not-found, .loading, .error {
        padding: 10px;
        color: #333;
    }
</style>

<div class="Search">
    <form on:submit|preventDefault={search}>
        <input type="search" placeholder="Type something to find a book" bind:value={query}>
        <input type="submit" value="Search">
    </form>

    <h2>Search Results</h2>
    {#if $error}
        <div class="error">{$error}</div>
    {:else}
        {#if $loading }
                <div class="loading">Loading...</div>
            {:else}
                {#if $books.length}
                        <table>
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Author</th>
                                    <th>Pub. Year</th>
                                    <th>View</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each $books as book (book.id)}
                                    <tr>
                                        <td>{book.title}</td>
                                        <td>{book.author_name && book.author_name.join(', ')}</td>
                                        <td>{book.first_publish_year}</td>
                                        <td>
                                            <Link to={`/details/${book.cover_edition_key}`}>View</Link>
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    {:else}
                        <div class="not-found">Nothing found...</div>
                    {/if}
            {/if}
    {/if}
</div>
