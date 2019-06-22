import { openDB } from 'idb';

const CACHE = 'network-or-cache';
const CACHE_VERSION = 1;
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
    const cache = await caches.open(`${CACHE}:${CACHE_VERSION}`);
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
    console.info('Service worker is active!!!!');
    e.waitUntil(activateHandler());
});

async function activateHandler() {
    // Initiate DB
    const db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
            const store = db.createObjectStore('books', {keyPath: 'key'});
            store.createIndex('title', 'title');
        }
    });
    // Clear versioning cache
    const cacheNames = await caches.keys();
    await Promise.all(
        cacheNames.filter(function(cacheName) {
            const cacheVersion = cacheName.split(':')[1];
            return +cacheVersion !== CACHE_VERSION;
        }).map(function(cacheName) {
            console.log('Remove all cache ', cacheName);
            return caches.delete(cacheName);
        })
    );
    // Clear outdated API caches
    const cache = await caches.open(`${CACHE}:${CACHE_VERSION}`);
    const requests = await cache.keys();
    await Promise.all(
        requests.map((request) => {
            if (request.url.match(OPEN_LIBRARY_API_REGEXP)) {
                const maxAge = request.headers.get('Cache-Control');
                const dateTime = maxAge.split('=')[1];
                if(Date.now() > dateTime){
                    console.log('Removed api cache >>> ' , request.url);
                    return cache.delete(request);
                }
            }

            return null;
        })
    );

    return self.clients.claim();
}


self.addEventListener('fetch',  function(e) {
    e.respondWith(fetchHandler(e.request));
});

async function fetchHandler(request) {
    if (isStatic(request)) {
        console.log('The service worker is serving the static asset <<<<<');
        try {
            const response = await fromNetwork(request, STATIC_TIMEOUT);
            return response;
        } catch (err) {
            try {
                const response = await fromNetwork(request, STATIC_TIMEOUT);
                return response;
            } catch(err) {
                return await fromNetwork(request, INFINITE);
            }
        }
    }

    if (OPEN_LIBRARY_API_REGEXP.test(request.url)) {
        console.log('The service worker is serving open library api calls <<<<<');
        try {
            const response = await fromNetwork(request, API_TIMEOUT);
            return response;
        } catch (err) {
            try {
                const response = await fromCache(request);
                return response;
            } catch(err) {
                return await fromNetwork(request, INFINITE);
            }
        }
    }

    return fromNetwork(request, INFINITE);
}


async function fromNetwork(request, timeout) {
    console.log('From network<<<<<', request.url);
    const controller = new AbortController();
    const signal = controller.signal;

    const timeoutId = setTimeout(() => {
        console.log('Request timeout >>>>', request.url);
        controller.abort();
    }, timeout);
    const response = await fetch(request, {signal});
    clearTimeout(timeoutId);
    if (request.url.match(OPEN_LIBRARY_API_REGEXP)) {
        await cacheApiResponse(request, response);
        if (!isStatic(request) ) {
            await cacheInDB(response);
        }
        return response;
    } else {
        return response;
    }
}

async function fromCache(request) {
    console.log('From cache <<<<', request.url);
    const cache = await caches.open(`${CACHE}:${CACHE_VERSION}`);
    const matching = await cache.match(request);
    if (matching) {
        return matching;
    }
    throw Error('no-match');
}

async function fromDB(request) {
    throw Error('No impl');
}

async function cacheApiResponse(request, response) {
    console.log('cacheApiResponse <<<', request.url);
    const clonedResponse = response.clone();
    const cache = await caches.open(`${CACHE}:${CACHE_VERSION}`);
    // Cache on 6 hours
    const headers = new Headers({
        'Cache-Control': `max-age=${Date.now() + 1000 * 60 * 60 * 6}`
    });
    const clonedRequest = new Request(request.url, {headers});
    await cache.put(clonedRequest, clonedResponse);
    return clonedResponse;
}

async function cacheInDB(response) {
    console.log('Cache in DB <<<<');
    const clonedResponse = response.clone();
    const data = await clonedResponse.json();
    const db = await openDB(DB_NAME, DB_VERSION);
    await Promise.all(data.docs.map(doc => db.put('books', doc)));
}
