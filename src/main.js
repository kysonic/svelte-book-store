import App from './App.svelte';
import './initServiceWorker';

const app = new App({
	target: document.body
});

export default app;
