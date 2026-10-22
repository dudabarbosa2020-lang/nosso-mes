// Recarrega o app sozinho quando algum arquivo do projeto muda.
// Só funciona no computador (localhost), durante a construção; no app publicado não faz nada.
(function () {
  if (!['localhost', '127.0.0.1'].includes(location.hostname)) return;

  let versao = null;
  async function conferir() {
    try {
      const resposta = await fetch('/__versao', { cache: 'no-store' });
      const nova = await resposta.text();
      if (versao && nova !== versao) return location.reload();
      versao = nova;
    } catch (e) {
      // servidor desligado: tenta de novo daqui a pouco
    }
    setTimeout(conferir, 1000);
  }
  conferir();
})();
