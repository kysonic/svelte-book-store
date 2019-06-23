(function () {
    'use strict';

    const instanceOfAny = (object, constructors) => constructors.some(c => object instanceof c);

    let idbProxyableTypes;
    let cursorAdvanceMethods;
    // This is a function to prevent it throwing up in node environments.
    function getIdbProxyableTypes() {
        return idbProxyableTypes ||
            (idbProxyableTypes = [IDBDatabase, IDBObjectStore, IDBIndex, IDBCursor, IDBTransaction]);
    }
    // This is a function to prevent it throwing up in node environments.
    function getCursorAdvanceMethods() {
        return cursorAdvanceMethods || (cursorAdvanceMethods = [
            IDBCursor.prototype.advance,
            IDBCursor.prototype.continue,
            IDBCursor.prototype.continuePrimaryKey,
        ]);
    }
    const cursorRequestMap = new WeakMap();
    const transactionDoneMap = new WeakMap();
    const transactionStoreNamesMap = new WeakMap();
    const transformCache = new WeakMap();
    const reverseTransformCache = new WeakMap();
    function promisifyRequest(request) {
        const promise = new Promise((resolve, reject) => {
            const unlisten = () => {
                request.removeEventListener('success', success);
                request.removeEventListener('error', error);
            };
            const success = () => {
                resolve(wrap(request.result));
                unlisten();
            };
            const error = () => {
                reject(request.error);
                unlisten();
            };
            request.addEventListener('success', success);
            request.addEventListener('error', error);
        });
        promise.then((value) => {
            // Since cursoring reuses the IDBRequest (*sigh*), we cache it for later retrieval
            // (see wrapFunction).
            if (value instanceof IDBCursor) {
                cursorRequestMap.set(value, request);
            }
        });
        // This mapping exists in reverseTransformCache but doesn't doesn't exist in transformCache. This
        // is because we create many promises from a single IDBRequest.
        reverseTransformCache.set(promise, request);
        return promise;
    }
    function cacheDonePromiseForTransaction(tx) {
        // Early bail if we've already created a done promise for this transaction.
        if (transactionDoneMap.has(tx))
            return;
        const done = new Promise((resolve, reject) => {
            const unlisten = () => {
                tx.removeEventListener('complete', complete);
                tx.removeEventListener('error', error);
                tx.removeEventListener('abort', error);
            };
            const complete = () => {
                resolve();
                unlisten();
            };
            const error = () => {
                reject(tx.error);
                unlisten();
            };
            tx.addEventListener('complete', complete);
            tx.addEventListener('error', error);
            tx.addEventListener('abort', error);
        });
        // Cache it for later retrieval.
        transactionDoneMap.set(tx, done);
    }
    let idbProxyTraps = {
        get(target, prop, receiver) {
            if (target instanceof IDBTransaction) {
                // Special handling for transaction.done.
                if (prop === 'done')
                    return transactionDoneMap.get(target);
                // Polyfill for objectStoreNames because of Edge.
                if (prop === 'objectStoreNames') {
                    return target.objectStoreNames || transactionStoreNamesMap.get(target);
                }
                // Make tx.store return the only store in the transaction, or undefined if there are many.
                if (prop === 'store') {
                    return receiver.objectStoreNames[1] ?
                        undefined : receiver.objectStore(receiver.objectStoreNames[0]);
                }
            }
            // Else transform whatever we get back.
            return wrap(target[prop]);
        },
        has(target, prop) {
            if (target instanceof IDBTransaction && (prop === 'done' || prop === 'store'))
                return true;
            return prop in target;
        },
    };
    function addTraps(callback) {
        idbProxyTraps = callback(idbProxyTraps);
    }
    function wrapFunction(func) {
        // Due to expected object equality (which is enforced by the caching in `wrap`), we
        // only create one new func per func.
        // Edge doesn't support objectStoreNames (booo), so we polyfill it here.
        if (func === IDBDatabase.prototype.transaction &&
            !('objectStoreNames' in IDBTransaction.prototype)) {
            return function (storeNames, ...args) {
                const tx = func.call(unwrap(this), storeNames, ...args);
                transactionStoreNamesMap.set(tx, storeNames.sort ? storeNames.sort() : [storeNames]);
                return wrap(tx);
            };
        }
        // Cursor methods are special, as the behaviour is a little more different to standard IDB. In
        // IDB, you advance the cursor and wait for a new 'success' on the IDBRequest that gave you the
        // cursor. It's kinda like a promise that can resolve with many values. That doesn't make sense
        // with real promises, so each advance methods returns a new promise for the cursor object, or
        // undefined if the end of the cursor has been reached.
        if (getCursorAdvanceMethods().includes(func)) {
            return function (...args) {
                // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
                // the original object.
                func.apply(unwrap(this), args);
                return wrap(cursorRequestMap.get(this));
            };
        }
        return function (...args) {
            // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
            // the original object.
            return wrap(func.apply(unwrap(this), args));
        };
    }
    function transformCachableValue(value) {
        if (typeof value === 'function')
            return wrapFunction(value);
        // This doesn't return, it just creates a 'done' promise for the transaction,
        // which is later returned for transaction.done (see idbObjectHandler).
        if (value instanceof IDBTransaction)
            cacheDonePromiseForTransaction(value);
        if (instanceOfAny(value, getIdbProxyableTypes()))
            return new Proxy(value, idbProxyTraps);
        // Return the same value back if we're not going to transform it.
        return value;
    }
    function wrap(value) {
        // We sometimes generate multiple promises from a single IDBRequest (eg when cursoring), because
        // IDB is weird and a single IDBRequest can yield many responses, so these can't be cached.
        if (value instanceof IDBRequest)
            return promisifyRequest(value);
        // If we've already transformed this value before, reuse the transformed value.
        // This is faster, but it also provides object equality.
        if (transformCache.has(value))
            return transformCache.get(value);
        const newValue = transformCachableValue(value);
        // Not all types are transformed.
        // These may be primitive types, so they can't be WeakMap keys.
        if (newValue !== value) {
            transformCache.set(value, newValue);
            reverseTransformCache.set(newValue, value);
        }
        return newValue;
    }
    const unwrap = (value) => reverseTransformCache.get(value);

    /**
     * Open a database.
     *
     * @param name Name of the database.
     * @param version Schema version.
     * @param callbacks Additional callbacks.
     */
    function openDB(name, version, { blocked, upgrade, blocking } = {}) {
        const request = indexedDB.open(name, version);
        const openPromise = wrap(request);
        if (upgrade) {
            request.addEventListener('upgradeneeded', (event) => {
                upgrade(wrap(request.result), event.oldVersion, event.newVersion, wrap(request.transaction));
            });
        }
        if (blocked)
            request.addEventListener('blocked', () => blocked());
        if (blocking)
            openPromise.then(db => db.addEventListener('versionchange', blocking));
        return openPromise;
    }

    const readMethods = ['get', 'getKey', 'getAll', 'getAllKeys', 'count'];
    const writeMethods = ['put', 'add', 'delete', 'clear'];
    const cachedMethods = new Map();
    function getMethod(target, prop) {
        if (!(target instanceof IDBDatabase &&
            !(prop in target) &&
            typeof prop === 'string'))
            return;
        if (cachedMethods.get(prop))
            return cachedMethods.get(prop);
        const targetFuncName = prop.replace(/FromIndex$/, '');
        const useIndex = prop !== targetFuncName;
        const isWrite = writeMethods.includes(targetFuncName);
        if (
        // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
        !(targetFuncName in (useIndex ? IDBIndex : IDBObjectStore).prototype) ||
            !(isWrite || readMethods.includes(targetFuncName)))
            return;
        const method = async function (storeName, ...args) {
            const tx = this.transaction(storeName, isWrite ? 'readwrite' : 'readonly');
            let target = tx.store;
            if (useIndex)
                target = target.index(args.shift());
            const returnVal = target[targetFuncName](...args);
            if (isWrite)
                await tx.done;
            return returnVal;
        };
        cachedMethods.set(prop, method);
        return method;
    }
    addTraps(oldTraps => ({
        get: (target, prop, receiver) => getMethod(target, prop) || oldTraps.get(target, prop, receiver),
        has: (target, prop) => !!getMethod(target, prop) || oldTraps.has(target, prop),
    }));

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
            './data/navigation.json'
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
        console.log(`Fetch >>> ${request.url}. Online: ${navigator.onLine}`);

        if (isSPA(request) && !navigator.onLine) {
            return await fromCache(new Request('/'));
        }

        if (isStatic(request)) {
            console.log('The service worker is serving the static asset <<<<<');
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
            console.log('The service worker is serving open library api calls <<<<<');
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

}());
//# sourceMappingURL=service-worker.js.map
