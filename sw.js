// Bump this version whenever index.html changes so phones pick up the new build.
const CACHE = 'snapcount-v40';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png'
];

// Each file is fetched fresh for this exact version: cache:'reload' skips the browser's
// HTTP cache, and the ?v= tag skips GitHub's CDN copy (which can lag a deploy by ~10
// minutes). Without both, a new version could cache the previous build's index.html.
// Files are stored under their plain URLs, which is what the app requests.
// If any download fails, install fails and the current version keeps running.
function fetchFresh(url){
  var sep = url.indexOf('?') === -1 ? '?' : '&';
  return fetch(new Request(url + sep + 'v=' + encodeURIComponent(CACHE), { cache: 'reload' }))
    .then(function(res){
      if (!res.ok) throw new Error(url + ' -> HTTP ' + res.status);
      return res;
    });
}

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){
        return Promise.all(ASSETS.map(function(url){
          return fetchFresh(url).then(function(res){ return c.put(url, res); });
        }));
      })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

// Lets the page tell a waiting worker to take over immediately (Check for updates).
self.addEventListener('message', function(e){
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // Cross-origin requests (Google Fonts, GoatCounter) go straight to the network.
  if (url.origin !== self.location.origin){
    e.respondWith(fetch(req).catch(function(){
      return new Response('', { status: 503, statusText: 'Offline' });
    }));
    return;
  }

  // App shell: serve from cache first so it opens instantly and works with no signal.
  e.respondWith(
    caches.match(req).then(function(hit){
      if (hit) return hit;
      return fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy); }).catch(function(){});
        return res;
      }).catch(function(){
        return caches.match('./index.html');
      });
    })
  );
});
