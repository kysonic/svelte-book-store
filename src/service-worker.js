import { openDB } from 'idb';

const CACHE = 'network-or-cache';
const CACHE_VERSION = 1;
const INFINITE = 99999999999999999;
const DB_NAME = 'openlibrary';
const DB_VERSION = 1;
const STATIC_TIMEOUT = 400;
const API_TIMEOUT = 1000;
const DEBUG = false;

const debug = (...args) => DEBUG && console.log(args);

function isStatic(request) {
    return request.destination;
}

function isSPA(request) {
    return request.destination === 'unknown';
}

const OPEN_LIBRARY_API_REGEXP = /openlibrary/ig;
const OPEN_LIBRARY_STATIC_REGEXP = /covers/ig;

async function precache() {
    const cache = await caches.open(`${CACHE}:${CACHE_VERSION}`);
    // Serve static resources
    return cache.addAll([
        './',
        './index.html',
        './bundle.css',
        './global.css',
        './bundle.js',
        './data/navigation.json',
        './manifest.json',
        './favicon.png'
    ]);
}

self.addEventListener('install', (e) => {
    debug('Service worker being installed!!!!');
    e.waitUntil(precache());
});

self.addEventListener('activate', (e) => {
    debug('Service worker is active!!!!');
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
    debug(`Fetch >>> ${request.url}. Online: ${navigator.onLine}`);

    if (isSPA(request) && !navigator.onLine) {
        return await fromCache(new Request('/'));
    }

    if (isStatic(request)) {
        debug('The service worker is serving the static asset <<<<<');
        // Looking for static cache if we are offline
        if (!navigator.onLine) {
            return await fromCache(request);
        }
        try {
            const response = await fromNetwork(request, STATIC_TIMEOUT);
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

    if (OPEN_LIBRARY_API_REGEXP.test(request.url) && !OPEN_LIBRARY_STATIC_REGEXP.test(request.url)) {
        debug('The service worker is serving open library api calls <<<<<');
        // Handle all offline request through indexedDB
        if (!navigator.onLine) {
            return await fromDB(request);
        }
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

    return navigator.onLine ? fromNetwork(request, INFINITE) : fromCache(request);
}


async function fromNetwork(request, timeout) {
    debug('From network<<<<<', request.url);
    const controller = new AbortController();
    const signal = controller.signal;

    const timeoutId = setTimeout(() => {
        debug('Request timeout >>>>', request.url);
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
    debug('From cache <<<<', request.url);
    const cache = await caches.open(`${CACHE}:${CACHE_VERSION}`);
    const matching = await cache.match(request);
    if (matching) {
        return matching;
    }
    throw Error('no-match');
}

async function fromDB(request) {
    debug('From DB >>>', request.url);
    const url = new URL(request.url);
    const query = url.searchParams.get('title');
    const db = await openDB(DB_NAME, DB_VERSION);
    const books = await db.getAllFromIndex('books', 'title', query);
    const data = {docs: books, start:0, numFound: 9999};
    const blob = new Blob([JSON.stringify(data, null, 2)], {type : 'application/json'});
    const opts = { "status" : 200 , "statusText" : "SuperSmashingGreat!" };
    return  new Response(blob, opts);
}

async function cacheApiResponse(request, response) {
    debug('cacheApiResponse <<<', request.url);
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
    debug('Cache in DB <<<<');
    const clonedResponse = response.clone();
    const data = await clonedResponse.json();
    const db = await openDB(DB_NAME, DB_VERSION);
    await Promise.all(data.docs.map(doc => db.put('books', doc)));
}

// Push

self.addEventListener('push', function(event) {
    console.log(event, event.data);
    const payload = event.data ? event.data.text() : 'WTF?';

    event.waitUntil(
        self.registration.showNotification('My first spell', {
            body: payload,
        })
    );
});
