import { openDB, deleteDB, wrap, unwrap } from 'idb';

const CACHE = 'network-or-cache';
const INFINITE = 99999999999999999;
const DB_NAME = 'openlibrary';
const DB_VERSION = 1;

function isStatic(request) {
    return request.destination;
}

const OPEN_LIBRARY_API_REGEXP = /openlibrary/ig;

async function precache() {
    const cache = await caches.open(CACHE);
    return cache.addAll([
        './index.html',
        './bundle.css',
        './global.css',
        './bundle.js'
    ]);
}

self.addEventListener('install', (e) => {
    console.info('Service worker being installed!!!!');
    e.waitUntil(precache());
});

self.addEventListener('activate', (e) => {
    console.info('Service worker is active');
    e.waitUntil(openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
            db.createObjectStore('books', {keyPath: 'cover_edition_key'});
        }
    }));
});


self.addEventListener('fetch', function(e) {
    console.log(1, isStatic(e.request));
    if (isStatic(e.request)) {
        console.log('The service worker is serving the static asset.');
        return e.respondWith(fromNetwork(e.request, 400).catch(function () {
            return fromCache(e.request).catch(() => fromNetwork(e.request, INFINITE));
        }));
    }

    if (OPEN_LIBRARY_API_REGEXP.test(e.request.url)) {
        console.log('The service worker is serving open library api calls.');
        return e.respondWith(fromNetwork(e.request, INFINITE).catch(function () {
            return fromDB(e.request).catch(() => fromNetwork(e.request, INFINITE));
        }));
    }
    console.log(3);
    return false;
});


function fromNetwork(request, timeout) {
    return new Promise(function (fulfill, reject) {
        const timeoutId = setTimeout(reject, timeout);
        fetch(request).then(function (response) {
            clearTimeout(timeoutId);
            if (request.url.match(OPEN_LIBRARY_API_REGEXP)) {
                cacheInDB(response);
            }
            fulfill(response);
        }, reject);
    });
}

async function fromCache(request) {
    const cache = await caches.open(CACHE);
    const matching = await cache.match(request);

    return matching || Promise.reject('no-match');
}

async function fromDB(request) {
    throw Error('123');
}

async function cacheInDB(response) {
    console.log('Cache in DB');
    const data = await response.json();
    const db = await openDB(DB_NAME, DB_VERSION);
    await db.add('books', data.docs[0])
    console.log('Items are cached');
}
