import App from './App.svelte';

navigator.serviceWorker.register('./service-worker.js');

const app = new App({
	target: document.body
});

export default app;
