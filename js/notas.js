// Nosso Mês — as anotações que vocês não podem esquecer.
// Cada anotação guarda quem escreveu e quando, e, se alguém mudar o texto, quem mudou e quando.
// Quem e quando são carimbados pelo banco (o app só manda o texto), então não dá pra errar nem falsificar.
// As anotações ficam fora do objeto `dados` (têm o próprio caminho de gravação), por isso o
// "Apagar tudo" dos Ajustes não mexe nelas.

let notas = [];          // da mais nova pra mais antiga
let notasLidasEm = 0;    // quando foi a última leitura no banco (ms)
let notasComErro = false;
let atualizandoNotas = false;

function deNota(r) {
  return {
    id: r.id,
    texto: r.texto,
    autor: r.autor_pessoa,          // 'p1' | 'p2' | null
    criadaEm: r.criado_em,
    editadaEm: r.editado_em,
    editor: r.editado_por_pessoa,
  };
}

// Lê as anotações do banco. Devolve true se algo mudou em relação ao que estava na tela.
async function carregarNotas() {
  notasLidasEm = Date.now();
  const { data, error } = await sb.from('notas').select('*').order('criado_em', { ascending: false });
  if (error) {
    console.error('Erro ao ler as anotações:', error);
    notasComErro = true;
    return false;
  }
  notasComErro = false;
  const novas = data.map(deNota);
  const mudou = JSON.stringify(novas) !== JSON.stringify(notas);
  notas = novas;
  return mudou;
}

// Ao abrir a tela, confere se a outra pessoa escreveu algo (no máximo a cada 20 segundos)
async function atualizarNotasSePreciso() {
  if (atualizandoNotas || Date.now() - notasLidasEm < 20000) return;
  atualizandoNotas = true;
  const mudou = await carregarNotas();
  atualizandoNotas = false;
  if (mudou && lerRota().rota === 'notas' && !editando && !preenchendo()) mostrarTela();
}

// "28/10/2026 às 19:05"
function dataHora(iso) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function nomeDeQuemEscreveu(pessoa) {
  return pessoa === 'p1' || pessoa === 'p2' ? nomePessoa(pessoa) : 'Alguém';
}

// ---------- Desenho da tela ----------

function linhaNota(nota) {
  const acoes = nota
    ? `
      <div class="linha-acoes editar">
        <button type="button" class="botao perigo-texto" data-acao="apagar-nota" data-id="${nota.id}">Apagar</button>
        <button type="button" class="botao pequeno secundario" data-acao="cancelar-edicao">Cancelar</button>
        <button class="botao pequeno">Salvar</button>
      </div>`
    : `<div class="linha-acoes"><button class="botao pequeno">Anotar</button></div>`;
  return `
    <form class="linha-form linha-nota" data-form="nota" data-id="${nota ? nota.id : ''}">
      <label class="campo">
        <span>${nota ? 'Anotação' : 'O que não pode ser esquecido?'}</span>
        <textarea name="texto" rows="3" required placeholder="Escreva aqui…">${esc(nota ? nota.texto : '')}</textarea>
      </label>
      ${acoes}
    </form>`;
}

function itemNota(nota) {
  if (nota.id === editando) return `<li class="editando">${linhaNota(nota)}</li>`;
  const alterada = nota.editadaEm
    ? `<span class="detalhe">Alterada por ${esc(nomeDeQuemEscreveu(nota.editor))} · ${dataHora(nota.editadaEm)}</span>`
    : '';
  return `
    <li class="nota">
      <div class="nota-corpo">
        <p class="nota-texto">${esc(nota.texto)}</p>
        <span class="detalhe">Escrita por ${esc(nomeDeQuemEscreveu(nota.autor))} · ${dataHora(nota.criadaEm)}</span>
        ${alterada}
      </div>
      ${minhaPessoa ? `<button class="botao-texto" data-acao="editar-nota" data-id="${nota.id}">Editar</button>` : ''}
    </li>`;
}

function perguntaQuemEstaUsando() {
  return `
    <section class="secao primeira">
      <h2>Quem está usando o app?</h2>
      <p class="ajuda">Assim cada anotação mostra quem escreveu. Isso fica guardado neste login, em qualquer aparelho.</p>
      <div class="campos-lado">
        <button class="botao" data-acao="eu-sou" data-pessoa="p1">${esc(dados.casal.pessoa1)}</button>
        <button class="botao" data-acao="eu-sou" data-pessoa="p2">${esc(dados.casal.pessoa2)}</button>
      </div>
    </section>`;
}

function telaNotas() {
  const nova = minhaPessoa
    ? `<section class="secao primeira nova-linha"><h2>Nova anotação</h2>${linhaNota()}</section>`
    : perguntaQuemEstaUsando();

  if (notasComErro && !notas.length) {
    return `
      ${nova}
      <div class="vazio">
        <div class="icone">${icone('aviso')}</div>
        <strong>Não consegui abrir as anotações</strong>
        <p>Pode ser a internet. Saia desta tela e volte pra tentar de novo.</p>
      </div>`;
  }

  if (!notas.length) {
    return `
      ${nova}
      <div class="vazio">
        <div class="icone">${icone('nota')}</div>
        <strong>Nenhuma anotação ainda</strong>
        <p>Escrevam aqui o que não pode ser esquecido. Fica registrado quem escreveu e quando.</p>
      </div>`;
  }

  return `
    ${nova}
    <section class="secao">
      <ul class="lista">${notas.map(itemNota).join('')}</ul>
    </section>`;
}

// ---------- Ações ----------

async function salvarNota(form) {
  const texto = form.elements.texto.value.trim();
  if (!texto) {
    avisar('Escrevam a anotação 😉');
    return form.elements.texto.focus();
  }
  if (!minhaPessoa) return avisar('Primeiro diga quem está usando o app');

  const id = form.dataset.id;
  const antiga = id && notas.find(n => n.id === id);
  if (antiga && antiga.texto === texto) return pararDeEditar(); // nada mudou: não conta como alteração

  const botao = form.querySelector('button:not([type=button])');
  botao.disabled = true;
  try {
    if (id) {
      const { data, error } = await sb.from('notas').update({ texto }).eq('id', id).select().single();
      if (error) throw error;
      notas = notas.map(n => (n.id === id ? deNota(data) : n));
    } else {
      const { data, error } = await sb.from('notas').insert({ casal_id: casalId, texto }).select().single();
      if (error) throw error;
      notas = [deNota(data), ...notas];
    }
  } catch (erro) {
    console.error('Erro ao salvar a anotação:', erro);
    botao.disabled = false;
    return avisar('Não consegui salvar a anotação agora 😕');
  }
  editando = null;
  mostrarTela();
  if (!id) focarLinha('.nova-linha');
  avisar(id ? 'Salvo ✓' : 'Anotado ✓');
}

async function apagarNotaComPergunta(id) {
  if (!(await confirmarApagar('Apagar esta anotação?', 'Ela some pros dois. Isso não dá pra desfazer.'))) return;
  const { error } = await sb.from('notas').delete().eq('id', id);
  if (error) {
    console.error('Erro ao apagar a anotação:', error);
    return avisar('Não consegui apagar agora 😕');
  }
  notas = notas.filter(n => n.id !== id);
  editando = null;
  mostrarTela();
  avisar('Apagada');
}

// Guarda no banco quem é este login (pessoa 1 ou 2)
async function escolherPessoa(pessoa) {
  const { error } = await sb.rpc('definir_minha_pessoa', { p_pessoa: pessoa });
  if (error) {
    console.error('Erro ao guardar quem é:', error);
    return avisar('Não consegui guardar agora 😕');
  }
  minhaPessoa = pessoa;
  mostrarTela();
  avisar(`Oi, ${nomePessoa(pessoa)}!`);
}

async function trocarPessoa() {
  const escolha = await perguntar('Quem está usando o app?', 'Vale pras próximas anotações. As que já existem não mudam.', [
    { texto: esc(dados.casal.pessoa1), valor: 'p1' },
    { texto: esc(dados.casal.pessoa2), valor: 'p2' },
    { texto: 'Cancelar', valor: null, estilo: 'secundario' },
  ]);
  if (escolha) escolherPessoa(escolha);
}
