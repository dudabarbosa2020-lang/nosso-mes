// Nosso Mês — service worker. Faz o app ser "instalável" (ícone na tela) e abrir rápido.
// Estratégia: rede primeiro (pra sempre pegar a versão nova), com o cache como reserva quando estiver offline.
// Nunca mexe nas chamadas do Supabase nem do CDN (outro endereço): essas passam direto.

const CACHE = 'nosso-mes-v1';
const CASCA = [
  '/', '/index.html', '/manifest.webmanifest',
  '/css/estilos.css',
  '/js/dev-reload.js', '/js/supabase.js', '/js/dados.js', '/js/dados-nuvem.js',
  '/js/importar.js', '/js/telas.js', '/js/telas-cartoes.js', '/js/telas-empresas.js',
  '/js/notas.js', '/js/comprovantes.js', '/js/auth.js', '/js/app.js',
  '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png',
];

self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CASCA)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys()
      .then(chaves => Promise.all(chaves.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', evento => {
  const url = new URL(evento.request.url);
  // Só cuida dos arquivos do próprio app. Supabase, fontes e CDN passam direto.
  if (evento.request.method !== 'GET' || url.origin !== self.location.origin) return;

  evento.respondWith(
    fetch(evento.request)
      .then(resposta => {
        const copia = resposta.clone();
        caches.open(CACHE).then(c => c.put(evento.request, copia));
        return resposta;
      })
      .catch(() => caches.match(evento.request).then(r => r || caches.match('/index.html')))
  );
});
