import { writable } from 'svelte/store';
import axios from 'axios';

const {subscribe, set, update} = writable([]);
const loading = writable(false);
const error = writable('');

const BASE_URL = 'http://openlibrary.org';

const BooksStore = () => ({
    subscribe,
    set,
    loading,
    error,
    async search(query) {
        try {
            error.set('');
            loading.set(true);
            const response = await axios.get(`${BASE_URL}/search.json?title=${query}`);
            loading.set(false);
            set(response.data.docs);
            return response.data;
        } catch(e) {
            loading.set(false);
            set([]);
            error.set(`Error has been occurred. Details: ${e.message}`);
        }
    }
});

export default BooksStore();
