import App from './App.svelte';
import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/messaging';

const firebaseConfig = {
	apiKey: "AIzaSyDdQgFHDDuyX6Bd0mtvrGe6CBYgxAyqyak",
	authDomain: "test-push-e1041.firebaseapp.com",
	databaseURL: "https://test-push-e1041.firebaseio.com",
	projectId: "test-push-e1041",
	storageBucket: "",
	messagingSenderId: "707303935445",
	appId: "1:707303935445:web:31fe87992298a74d"
};

firebase.initializeApp(firebaseConfig);

// Service worker
(() => {
	let reg = null;
	navigator.serviceWorker.register('./service-worker.js').then((registration) => {
		console.log('Service worker was registered +++++');
		reg = registration;
		return registration.pushManager.getSubscription()
	}).then((subscription) => {
		console.log('Attempt to get subscription +++++', subscription);
		if (subscription) {
			return subscription;
		}
		return reg.pushManager.subscribe({ userVisibleOnly: true });
	}).then((subscription) => {
		/*console.log('Service get subscription +++++', subscription);
		const rawKey = subscription.getKey ? subscription.getKey('p256dh') : '';
		const key = rawKey ? btoa(String.fromCharCode.apply(null, new Uint8Array(rawKey))) : '';
		const rawAuthSecret = subscription.getKey ? subscription.getKey('auth') : '';
		const authSecret = rawAuthSecret ? btoa(String.fromCharCode.apply(null, new Uint8Array(rawAuthSecret))) : '';
		const endpoint = subscription.endpoint;
		console.log(rawKey, key, rawAuthSecret, authSecret, endpoint);*/
		console.log('Get messaging api');
		console.log(firebase);
		const messaging = firebase.messaging();
		console.log('Set public key');
		messaging.usePublicVapidKey('BObhD5x-CspJOjK8Z3JskhBA9r380vO5vukfxnEyPDOsTGq_ndT9hwg43cvxtZb525NUyHZgTwO8ddVnF8JKYBc');
		console.log('Get token');
		return messaging.getToken();
	}).then((currentToken) => {
		console.log('Current token obtained', currentToken);
		return fetch('http://localhost:3003/register', {
			method: 'post',
			headers: {
				'Content-type': 'application/json'
			},
			body: JSON.stringify({
				currentToken
			}),
		});

	})
	.catch(err => console.error(err));
})();


const app = new App({
	target: document.body
});

export default app;
