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

let reg = null;

navigator.serviceWorker.register('./service-worker.js').then((registration) => {
    reg = registration;
    return registration.pushManager.getSubscription()
}).then((subscription) => {
    if (subscription) {
        return subscription;
    }
    return reg.pushManager.subscribe({ userVisibleOnly: true });
}).then((subscription) => {
    const messaging = firebase.messaging();
    messaging.usePublicVapidKey('BObhD5x-CspJOjK8Z3JskhBA9r380vO5vukfxnEyPDOsTGq_ndT9hwg43cvxtZb525NUyHZgTwO8ddVnF8JKYBc');
    return messaging.getToken();
}).then((currentToken) => {
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

// Test sync
setTimeout(() => {
    console.log('Run upd');
    reg.sync.register('update')
}, 10000);

export default reg;
