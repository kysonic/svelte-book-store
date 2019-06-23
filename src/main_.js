import App from './App.svelte';
const PUBLIC_KEY = 'BAkx_xRulkJ9IRjHOR8EFLS5te2Iw-EXMhYM5jsxQLVjTgjtagPwEnJ8Alg_9QpKRvi_1A7tb0T6JZnDcwKzEGQ';

// Url Encription
function urlB64ToUint8Array(base64String) {
	const padding = '='.repeat((4 - base64String.length % 4) % 4);
	const base64 = (base64String + padding)
		.replace(/\-/g, '+')
		.replace(/_/g, '/');

	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);

	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

// Service worker
(() => {
	let reg = null;
	navigator.serviceWorker.register('./service-worker.js').then((registration) => {
		reg = registration;
		return registration.pushManager.getSubscription()
	}).then((subscription) => {
		if (subscription) {
			return subscription;
		}
		return reg.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlB64ToUint8Array(PUBLIC_KEY)
		});
	}).then((subscription) => {
		console.log('Service get subscription +++++', subscription);
		const rawKey = subscription.getKey ? subscription.getKey('p256dh') : '';
		const key = rawKey ? btoa(String.fromCharCode.apply(null, new Uint8Array(rawKey))) : '';
		const rawAuthSecret = subscription.getKey ? subscription.getKey('auth') : '';
		const authSecret = rawAuthSecret ? btoa(String.fromCharCode.apply(null, new Uint8Array(rawAuthSecret))) : '';
		const endpoint = subscription.endpoint;
		console.log(rawKey, key, rawAuthSecret, authSecret, endpoint);
		return {key, authSecret, endpoint};
	}).then((subscription) => {
		return fetch('http://localhost:3003/register', {
			method: 'post',
			headers: {
				'Content-type': 'application/json'
			},
			body: JSON.stringify({
				subscription
			}),
		});
	})
	.catch(err => console.error(err));
})();


const app = new App({
	target: document.body
});

export default app;
