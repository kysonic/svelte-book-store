import { openDB, deleteDB, wrap, unwrap } from 'idb';

const CACHE = 'network-or-cache';
const INFINITE = 99999999999999999;
const DB_NAME = 'openlibrary';
const DB_VERSION = 1;
const STATIC_TIMEOUT = 400;
const API_TIMEOUT = 1000;

function isStatic(request) {
    return request.destination;
}

const OPEN_LIBRARY_API_REGEXP = /openlibrary/ig;

async function precache() {
    const cache = await caches.open(CACHE);
    // Serve static resources
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
    // Initiate database
    e.waitUntil(openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
            db.createObjectStore('books', {keyPath: 'cover_edition_key'});
        }
    }));
    // Clear cache
});


self.addEventListener('fetch', async function({respondWith, request}) {
    if (isStatic(request)) {
        console.log('The service worker is serving the static asset.');
        try {
            const response = await fromNetwork(request, STATIC_TIMEOUT);
            return respondWith(response);
        } catch (e) {
            console.log(e,1);
            try {
                const response = await fromCache(request);
                return respondWith(response);
            } catch(e) {
                console.log(e,2);
                const response = await fromNetwork(request, INFINITE);
                return respondWith(response);
            }
        }
    }

    if (OPEN_LIBRARY_API_REGEXP.test(e.request.url)) {
        console.log('The service worker is serving open library api calls.');
        try {
            const response = await fromNetwork(request, API_TIMEOUT);
            return respondWith(response);
        } catch (e) {
            try {
                const response = await fromCache(request);
                return respondWith(response);
            } catch(e) {
                const response = await fromNetwork(request, INFINITE);
                return respondWith(response);
            }
        }
    }

    return false;
});


async function fromNetwork(request, timeout) {
    const controller = new AbortController();
    const signal = controller.signal;

    const timeoutId = setTimeout(controller.abort, timeout);

    const response = await fetch(request, {signal});
    clearTimeout(timeoutId);
    if (request.url.match(OPEN_LIBRARY_API_REGEXP)) {
        await cacheInDB(response);
        return response;
    } else {
        return response;
    }
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
    await db.put('books', data.docs[0]);
    console.log('Items are cached');
}
