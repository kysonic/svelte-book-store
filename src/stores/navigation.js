import { writable } from 'svelte/store';
import axios from 'axios';
import {delay} from '../utils';

const {subscribe, set, update} = writable([]);
const loading = writable(false);
const error = writable(false);

const NavigationStore = () => ({
    subscribe,
    set,
    loading,
    error,
    async fetch() {
        try {
            loading.set(true);
            const response = await axios.get('/data/navigation.json');
            await delay(1000 + (Math.random() * 500));
            loading.set(false);
            set(response.data);
            return response.data;
        } catch(e) {
            loading.set(false);
            set([]);
            error.set(`Error has been occurred. Details: ${e.message}`);
        }
    }
});

export default NavigationStore();
