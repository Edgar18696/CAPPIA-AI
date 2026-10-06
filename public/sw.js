// PAIIA AI — service worker MÍNIMO, só para o Chrome permitir "Instalar".
// NÃO guarda nada em cache: toda abertura de página vai à rede, então quem
// usa o app instalado sempre recebe a versão publicada mais recente.
// Só observa a navegação de páginas do próprio site; chamadas ao Supabase,
// Mercado Livre, Bling, imagens e arquivos não passam por aqui.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  if (req.mode !== "navigate" || new URL(req.url).origin !== self.location.origin) return;
  evento.respondWith(fetch(req));
});
