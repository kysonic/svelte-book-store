<script>
    import books from '../../stores/books';
    import {getContext} from 'svelte';
    import {ROUTER} from 'svelte-routing/src/contexts';
    const { activeRoute } = getContext(ROUTER);
    $: book = $books.find(book => book.cover_edition_key = $activeRoute.params.id);
    $: imageSrc = `http://covers.openlibrary.org/b/OLID/${$activeRoute.params.id}-M.jpg`;
</script>

<style>
    .details {
        width: 100vw;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
    }
    .content {
        text-align: center;
    }
</style>

<div class="details">
    <h1>Book Details</h1>
    {#if book}
        <div class="content">
            <div class="details-card">
                <h3>{book.title}</h3>
                <img alt={book.title} src={imageSrc}/>
                <h4>Authors</h4>
                <p> {book.author_name && book.author_name.join(', ')}</p>
                <h4>Published</h4>
                <p>{book.first_publish_year}</p>
            </div>
        </div>
    {:else}
        <div>Book is not found...</div>
    {/if}
</div>
