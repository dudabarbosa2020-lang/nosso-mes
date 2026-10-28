// Nosso Mês — a foto do comprovante de cada conta paga.
// A foto é reduzida aqui no aparelho (uma foto de 4 MB vira ~300 KB) e guardada numa pasta privada
// do Supabase, dentro da subpasta do casal. Na conta fica só o caminho do arquivo (`conta.comprovante`).
// Quando a conta é apagada, o sincronizar (dados-nuvem.js) apaga a foto junto.

const PASTA_COMPROVANTES = 'comprovantes';
const LADO_MAXIMO_FOTO = 1600; // px, no lado maior: dá pra ler tudo no comprovante

function carregarImagem(arquivo) {
  return new Promise((resolver, rejeitar) => {
    const url = URL.createObjectURL(arquivo);
    const imagem = new Image();
    imagem.onload = () => { URL.revokeObjectURL(url); resolver(imagem); };
    imagem.onerror = () => { URL.revokeObjectURL(url); rejeitar(new Error('Não consegui ler esta imagem')); };
    imagem.src = url;
  });
}

// Devolve a foto menor, em JPEG
async function reduzirFoto(arquivo) {
  const imagem = await carregarImagem(arquivo);
  const escala = Math.min(1, LADO_MAXIMO_FOTO / Math.max(imagem.naturalWidth, imagem.naturalHeight));
  const largura = Math.round(imagem.naturalWidth * escala);
  const altura = Math.round(imagem.naturalHeight * escala);
  const quadro = document.createElement('canvas');
  quadro.width = largura;
  quadro.height = altura;
  const desenho = quadro.getContext('2d');
  desenho.fillStyle = '#FFFFFF'; // print com fundo transparente não vira preto
  desenho.fillRect(0, 0, largura, altura);
  desenho.drawImage(imagem, 0, 0, largura, altura);
  return new Promise((resolver, rejeitar) =>
    quadro.toBlob(blob => (blob ? resolver(blob) : rejeitar(new Error('Não consegui reduzir a foto'))), 'image/jpeg', 0.8));
}

// ---------- Janelas ----------

const campoFoto = conta => `<input type="file" accept="image/*" hidden data-comprovante="${conta.id}">`;

// Logo depois de marcar "Paguei"
function formOfertaComprovante(conta) {
  return `
    <div class="formulario">
      <h2>Paga ✓</h2>
      <p class="ajuda">Quer guardar a foto do comprovante de ${esc(conta.nome)}?</p>
      <div class="acoes-form coluna">
        <label class="botao">Tirar foto ou escolher${campoFoto(conta)}</label>
        <button type="button" class="botao secundario" data-acao="fechar">Agora não</button>
      </div>
    </div>`;
}

// Ao tocar no clipe de uma conta paga (com a foto, ou sem)
function formComprovante(conta, urlDaFoto) {
  const foto = urlDaFoto
    ? `<img class="comprovante-foto" src="${urlDaFoto}" alt="Comprovante de ${esc(conta.nome)}">`
    : `<p class="ajuda">Ainda não tem foto do comprovante.</p>`;
  return `
    <div class="formulario">
      <h2>Comprovante</h2>
      <p class="ajuda">${esc(conta.nome)} · ${real(conta.valor)}</p>
      ${foto}
      <div class="acoes-form coluna">
        <label class="botao">${urlDaFoto ? 'Trocar foto' : 'Tirar foto ou escolher'}${campoFoto(conta)}</label>
        ${urlDaFoto ? `<button type="button" class="botao perigo-texto" data-acao="remover-comprovante" data-id="${conta.id}">Remover foto</button>` : ''}
        <button type="button" class="botao secundario" data-acao="fechar">Fechar</button>
      </div>
    </div>`;
}

// ---------- Ações ----------

function oferecerComprovante(contaId) {
  const conta = dados.contas.find(c => c.id === contaId);
  if (!conta || conta.comprovante) return;
  abrirJanela(formOfertaComprovante(conta));
}

async function verComprovante(contaId) {
  const conta = dados.contas.find(c => c.id === contaId);
  if (!conta) return;
  if (!conta.comprovante) return abrirJanela(formComprovante(conta, null));

  abrirJanela('<div class="formulario"><h2>Comprovante</h2><p class="ajuda">Abrindo a foto…</p></div>');
  const { data, error } = await sb.storage.from(PASTA_COMPROVANTES).createSignedUrl(conta.comprovante, 300);
  if (error) {
    console.error('Erro ao abrir o comprovante:', error);
    fecharJanela();
    return avisar('Não consegui abrir a foto agora 😕');
  }
  abrirJanela(formComprovante(conta, data.signedUrl));
}

async function anexarComprovante(contaId, arquivo) {
  const conta = dados.contas.find(c => c.id === contaId);
  if (!conta || !casalId) return;
  fecharJanela();
  avisar('Guardando o comprovante…');
  try {
    const foto = await reduzirFoto(arquivo);
    const caminho = `${casalId}/${contaId}-${Date.now()}.jpg`; // nome novo a cada foto, pra nunca aparecer a antiga
    const { error } = await sb.storage.from(PASTA_COMPROVANTES).upload(caminho, foto, { contentType: 'image/jpeg' });
    if (error) throw error;
    const antigo = conta.comprovante;
    conta.comprovante = caminho;
    await salvar();
    if (antigo) sb.storage.from(PASTA_COMPROVANTES).remove([antigo]);
    mostrarTela();
    avisar('Comprovante guardado ✓');
  } catch (erro) {
    console.error('Erro ao guardar o comprovante:', erro);
    avisar('Não consegui guardar a foto agora 😕');
  }
}

async function removerComprovante(contaId) {
  const conta = dados.contas.find(c => c.id === contaId);
  if (!conta || !conta.comprovante) return;
  const ok = await perguntar('Remover o comprovante?', 'A foto some pros dois. Isso não dá pra desfazer.', [
    { texto: 'Remover', valor: true, estilo: 'perigo' },
    { texto: 'Cancelar', valor: null, estilo: 'secundario' },
  ]);
  if (!ok) return;
  const caminho = conta.comprovante;
  conta.comprovante = null;
  await salvar();
  sb.storage.from(PASTA_COMPROVANTES).remove([caminho]);
  mostrarTela();
  avisar('Comprovante removido');
}
