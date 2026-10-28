// Nosso Mês — o que acontece quando vocês tocam nos botões: trocar de tela, preencher as linhas, salvar.

let mesVisivel = mesAtual();
let editando = null; // id do item aberto pra edição dentro da lista (só um por vez)
let importacao = null; // a importação em andamento (arquivo lido + revisão); só na memória até salvar
let devolvendo = null; // empresa (grupo) com a linha "Devolveu" aberta

// "voltar" = telas que ficam dentro de outra (a fatura e a importação ficam dentro de Cartões)
const telas = {
  inicio: { titulo: 'Início', desenhar: telaInicio, comMes: true },
  contas: { titulo: 'Contas', desenhar: telaContas, comMes: true },
  cartoes: { titulo: 'Cartões', desenhar: telaCartoes, comMes: true },
  fatura: { titulo: 'Fatura', desenhar: telaFatura, voltar: 'cartoes' },
  importar: { titulo: 'Importar fatura', desenhar: telaImportar, voltar: 'cartoes' },
  descricoes: { titulo: 'Descrições padrão', desenhar: telaDescricoes, voltar: 'cartoes' },
  empresas: { titulo: 'Empresas', desenhar: telaEmpresas, comMes: true },
  ganhos: { titulo: 'Ganhos', desenhar: telaGanhos, comMes: true },
  notas: { titulo: 'Notas', desenhar: telaNotas, comMes: false },
  ajustes: { titulo: 'Ajustes', desenhar: telaAjustes, comMes: false },
};

// "#fatura/abc" → rota "fatura", partes ["abc"]
function lerRota() {
  const [rota, ...partes] = (location.hash.slice(1) || 'inicio').split('/');
  return { rota: telas[rota] ? rota : 'inicio', partes };
}

function mostrarTela() {
  const { rota, partes } = lerRota();
  const tela = telas[rota];

  prepararAte(mesVisivel > mesAtual() ? mesVisivel : mesAtual());
  if (rota === 'importar') prepararImportacao(partes);

  document.querySelectorAll('.navegacao a').forEach(link => {
    link.classList.toggle('ativo', link.dataset.tela === (tela.voltar || rota));
  });

  let titulo = rota === 'inicio' ? '<span class="nome-app">Nosso Mês</span>' : `<h1>${tela.titulo}</h1>`;
  if (rota === 'fatura') {
    const fatura = dados.faturas.find(f => f.id === partes[0]);
    const cartao = fatura && cartaoDe(fatura.cartaoId);
    if (cartao) titulo = `<h1>${esc(cartao.nome)}</h1>`;
  }
  if (tela.voltar) titulo = `<div class="titulo-com-volta"><a class="voltar" href="#${tela.voltar}">${icone('anterior')} ${telas[tela.voltar].titulo}</a>${titulo}</div>`;

  // No celular, Ajustes fica num botão no topo da Início (a barra de baixo tem só 5 lugares)
  const botaoAjustes = rota !== 'inicio' ? '' : `<a class="ajustes-topo so-celular" href="#ajustes" aria-label="Ajustes" title="Ajustes">${icone('ajustes')}</a>`;
  document.getElementById('topo').innerHTML = titulo + `<div class="topo-direita">${tela.comMes ? seletorMes() : ''}${botaoAjustes}</div>`;
  document.getElementById('tela').innerHTML = tela.desenhar(...partes);
  document.title = rota === 'inicio' ? 'Nosso Mês' : `${tela.titulo} · Nosso Mês`;
  if (rota === 'notas') atualizarNotasSePreciso(); // a outra pessoa pode ter escrito algo
}

// Começa uma importação nova quando se chega em "#importar/cartão/mês" (ou mantém a que está em andamento)
function prepararImportacao([cartaoId, mes]) {
  const chave = location.hash;
  if (importacao && importacao.chave === chave) return;
  const cartao = cartaoDe(cartaoId) || dados.cartoes[0];
  importacao = cartao ? {
    chave,
    cartaoId: cartao.id,
    mes: /^\d{4}-\d{2}$/.test(mes || '') ? mes : mesVisivel,
    etapa: 'arquivo',
    itens: [],
    valorBanco: null,
    substituir: false,
    nomeArquivo: '',
    lendo: false,
    erro: '',
  } : null;
}

// Põe o cursor no primeiro campo de uma linha (a nova, ou a que está em edição)
function focarLinha(seletor) {
  const campo = document.querySelector(`${seletor} input:not([type=hidden]), ${seletor} textarea`);
  if (campo) campo.focus();
}

function editar(id) {
  editando = id;
  mostrarTela();
  focarLinha('li.editando');
}

function pararDeEditar() {
  devolvendo = null;
  editando = null;
  mostrarTela();
}

// Vindo da Início (tela vazia), leva pra tela certa já com o cursor na linha nova
function irParaNovo(rota) {
  editando = null;
  if (location.hash.slice(1) !== rota) location.hash = rota; // o hashchange desenha a tela
  else mostrarTela();
  setTimeout(() => focarLinha('.nova-linha'), 50);
}

// Alguém está no meio de um preenchimento? (pra não apagar o que está sendo digitado)
function preenchendo() {
  const focado = document.activeElement;
  if (focado && focado.matches('input, select, textarea') && document.getElementById('tela').contains(focado)) return true;
  return [...document.querySelectorAll('.linha-form')].some(form =>
    [...form.querySelectorAll('input:not([type=checkbox]):not([type=hidden]), textarea')].some(campo => campo.value !== campo.defaultValue));
}

// ---------- Avisinho e janela por cima da tela ----------

let temporizadorAviso;
function avisar(texto) {
  const aviso = document.getElementById('aviso');
  aviso.textContent = texto;
  aviso.classList.add('visivel');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => aviso.classList.remove('visivel'), 2400);
}

const janela = document.getElementById('janela');

function abrirJanela(html) {
  janela.innerHTML = html;
  if (!janela.open) janela.showModal();
}

function fecharJanela() {
  if (janela.open) janela.close();
}

// Mostra uma pergunta com botões e devolve a escolha (ou null se fechar)
function perguntar(titulo, texto, escolhas) {
  return new Promise(resolver => {
    abrirJanela(formPergunta(titulo, texto, escolhas));
    const aoClicar = evento => {
      const botao = evento.target.closest('[data-escolha]');
      if (!botao) return;
      terminar(escolhas[botao.dataset.escolha].valor);
    };
    const aoFechar = () => terminar(null);
    function terminar(valor) {
      janela.removeEventListener('click', aoClicar);
      janela.removeEventListener('close', aoFechar);
      fecharJanela();
      resolver(valor);
    }
    janela.addEventListener('click', aoClicar);
    janela.addEventListener('close', aoFechar);
  });
}

// ---------- Ações ----------

async function apagarItem(tipo, id) {
  const item = listaDo(tipo).find(i => i.id === id);
  if (!item) return;
  const nome = esc(item.nome || item.descricao);
  let tambemProximos = false;

  if (item.serieId) {
    const escolha = await perguntar(`Apagar “${nome}”?`, 'Este item repete todo mês.', [
      { texto: 'Só deste mês', valor: 'este' },
      { texto: 'Deste mês em diante', valor: 'proximos', estilo: 'perigo' },
      { texto: 'Cancelar', valor: null, estilo: 'secundario' },
    ]);
    if (!escolha) return;
    tambemProximos = escolha === 'proximos';
  } else {
    const ok = await perguntar(`Apagar “${nome}”?`, 'Isso não dá pra desfazer.', [
      { texto: 'Apagar', valor: true, estilo: 'perigo' },
      { texto: 'Cancelar', valor: null, estilo: 'secundario' },
    ]);
    if (!ok) return;
  }

  apagar(tipo, id, tambemProximos);
  editando = null;
  mostrarTela();
  avisar('Apagado');
}

function salvarFormulario(form) {
  const tipo = form.dataset.form;
  const campos = new FormData(form);
  const valor = lerValor(campos.get('valor'));
  if (!(valor > 0)) {
    avisar('Confere o valor 😉');
    form.elements.valor.focus();
    return;
  }
  const feito = campos.get('feito') ? (campos.get('data') || hojeISO()) : null;

  let novo;
  if (tipo === 'conta') {
    const dia = Number(campos.get('dia'));
    if (!(dia >= 1 && dia <= 31)) {
      avisar('O dia do vencimento vai de 1 a 31');
      form.elements.dia.focus();
      return;
    }
    novo = {
      nome: campos.get('nome').trim(),
      valor,
      dia,
      categoriaId: campos.get('categoriaId'),
      grupoId: campos.get('grupoId'),
      pagaEm: feito,
    };
  } else {
    novo = {
      descricao: campos.get('descricao').trim(),
      valor,
      pessoa: campos.get('pessoa'),
      observacao: campos.get('observacao').trim(),
      recebidoEm: feito,
    };
  }

  const id = form.dataset.id;
  if (id) atualizar(tipo, id, novo);
  else adicionar(tipo, novo, mesVisivel, Boolean(campos.get('repete')));

  editando = null;
  mostrarTela();
  if (!id) focarLinha('.nova-linha'); // pronto pra cadastrar o próximo, como numa planilha
  avisar(id ? 'Salvo ✓' : 'Adicionado ✓');
}

// ---------- Cartões, faturas e compras ----------

function lerDia(form, nome, rotulo) {
  const dia = Number(form.elements[nome].value);
  if (dia >= 1 && dia <= 31) return dia;
  avisar(`O dia de ${rotulo} vai de 1 a 31`);
  form.elements[nome].focus();
  return null;
}

function salvarCartao(form) {
  const fechamento = lerDia(form, 'fechamento', 'fechamento');
  if (fechamento == null) return;
  const vencimento = lerDia(form, 'vencimento', 'vencimento');
  if (vencimento == null) return;
  const campos = {
    nome: form.elements.nome.value.trim(),
    banco: form.elements.banco.value.trim(),
    titular: form.elements.titular.value,
    fechamento,
    vencimento,
  };
  const id = form.dataset.id;
  if (id) atualizarCartao(id, campos);
  else adicionarCartao(campos);
  editando = null;
  mostrarTela();
  if (!id) focarLinha('.nova-linha');
  avisar(id ? 'Salvo ✓' : 'Cartão adicionado ✓');
}

// "5" e "6" → { atual: 5, total: 6 }; vazio → sem parcela; "7 de 6" → erro
function lerParcelaDosCampos(atualTexto, totalTexto) {
  const atual = Number(atualTexto), total = Number(totalTexto);
  if (!String(atualTexto).trim() && !String(totalTexto).trim()) return null;
  if (atual >= 1 && total >= 2 && atual <= total) return { atual, total };
  return undefined;
}

function salvarCompra(form) {
  const valor = lerValorComSinal(form.elements.valor.value);
  if (!Number.isFinite(valor) || valor === 0) {
    avisar('Confere o valor 😉');
    return form.elements.valor.focus();
  }
  const parcela = lerParcelaDosCampos(form.elements.parcelaAtual.value, form.elements.parcelaTotal.value);
  if (parcela === undefined) {
    avisar('Confere a parcela (ex.: 2 de 6)');
    return form.elements.parcelaAtual.focus();
  }
  const descricao = form.elements.descricao.value.trim();
  if (!descricao) {
    avisar('Escrevam a descrição da compra');
    return form.elements.descricao.focus();
  }
  // O texto original do banco (das importações) continua guardado; aqui só muda a descrição que vocês veem
  const campos = {
    data: form.elements.data.value || hojeISO(),
    descricao,
    valor,
    categoriaId: form.elements.categoriaId.value,
    grupoId: form.elements.grupoId.value,
    parcela,
  };
  const id = form.dataset.id;
  let aprendeu = false;
  if (id) {
    atualizarCompra(id, campos);
    aprendeu = aprenderDaCompra(dados.compras.find(c => c.id === id)); // da próxima vez, essa compra já vem assim
    if (aprendeu) salvar();
  } else adicionarCompra(form.dataset.fatura, { ...campos, descricaoBanco: '' });
  editando = null;
  mostrarTela();
  if (!id) focarLinha('.nova-linha');
  avisar(id ? `Salvo ✓${aprendeu ? ' · descrição padrão guardada' : ''}` : 'Compra adicionada ✓');
}

function salvarRegraDoFormulario(form) {
  const texto = form.elements.texto.value.trim();
  if (!chaveTexto(texto)) {
    avisar('Escrevam o texto que aparece no banco');
    return form.elements.texto.focus();
  }
  const campos = {
    texto,
    descricao: form.elements.descricao.value.trim(),
    categoriaId: form.elements.categoriaId.value,
    grupoId: form.elements.grupoId.value,
  };
  if (!campos.descricao && !campos.categoriaId && !campos.grupoId) {
    avisar('Escolham pelo menos o que trocar: descrição, categoria ou coluna');
    return form.elements.descricao.focus();
  }
  const id = form.dataset.id;
  const aplicadas = salvarRegra(id, campos);
  editando = null;
  mostrarTela();
  if (!id) focarLinha('.nova-linha');
  avisar(`${id ? 'Salvo' : 'Descrição padrão guardada'} ✓${aplicadas ? ` · aplicada em ${aplicadas} ${aplicadas === 1 ? 'compra' : 'compras'}` : ''}`);
}

async function apagarRegraComPergunta(id) {
  const regra = dados.regras.find(r => r.id === id);
  if (!regra || !(await confirmarApagar(`Apagar o padrão “${esc(regra.descricao || regra.texto)}”?`, 'As compras já salvas continuam como estão; só as próximas importações deixam de usar esse padrão.'))) return;
  apagarRegra(id);
  editando = null;
  mostrarTela();
  avisar('Padrão apagado');
}

function salvarValorBanco(form) {
  const texto = form.elements.valor.value.trim();
  const valor = texto ? lerValor(texto) : null;
  if (texto && !(valor > 0)) {
    avisar('Confere o valor 😉');
    return form.elements.valor.focus();
  }
  atualizarFatura(form.dataset.id, { valorBanco: valor });
  form.elements.valor.blur();
  mostrarTela();
  avisar(valor == null ? 'Usando a soma das compras' : 'Valor do banco salvo ✓');
}

function transformar(form) {
  const cartaoId = form.elements.cartaoId.value;
  if (!cartaoId) return avisar('Escolham o cartão');
  transformarEmFatura(form.dataset.id, cartaoId);
  mostrarTela();
  avisar('Agora é fatura do cartão ✓');
}

function criarFatura(cartaoId) {
  const fatura = garantirFatura(cartaoId, mesVisivel);
  salvar();
  location.hash = `fatura/${fatura.id}`;
}

async function confirmarApagar(titulo, texto) {
  return perguntar(titulo, texto, [
    { texto: 'Apagar', valor: true, estilo: 'perigo' },
    { texto: 'Cancelar', valor: null, estilo: 'secundario' },
  ]);
}

async function apagarCartaoComPergunta(id) {
  const cartao = cartaoDe(id);
  const faturas = dados.faturas.filter(f => f.cartaoId === id).length;
  const texto = faturas ? `As ${faturas} fatura(s) desse cartão e as compras delas também vão sumir. Isso não dá pra desfazer.` : 'Isso não dá pra desfazer.';
  if (!cartao || !(await confirmarApagar(`Apagar “${esc(cartao.nome)}”?`, texto))) return;
  apagarCartao(id);
  editando = null;
  mostrarTela();
  avisar('Cartão apagado');
}

async function apagarFaturaComPergunta(id) {
  const fatura = dados.faturas.find(f => f.id === id);
  if (!fatura) return;
  const qtd = comprasDa(id).length;
  if (!(await confirmarApagar('Apagar esta fatura?', qtd ? `As ${qtd} compras dela também vão sumir.` : 'Isso não dá pra desfazer.'))) return;
  apagarFatura(id);
  location.hash = 'cartoes';
  avisar('Fatura apagada');
}

// Muda a compra de coluna (Nosso · Eventique · Loja)
function moverCompra(id, grupoId) {
  const compra = dados.compras.find(c => c.id === id);
  const grupo = grupoDe(grupoId);
  if (!compra || !grupo || grupoDaCompra(compra).id === grupoId) return;
  atualizarCompra(id, { grupoId });
  if (aprenderDaCompra(compra)) salvar(); // na próxima fatura, essa compra já cai nessa coluna
  mostrarTela();
  avisar(`Movida pra ${grupo.nome} ✓`);
}

async function moverCompraComPergunta(id) {
  const compra = dados.compras.find(c => c.id === id);
  if (!compra) return;
  const atual = grupoDaCompra(compra).id;
  const destino = await perguntar(`Mover “${esc(compra.descricao || compra.descricaoBanco)}” pra…`, 'Escolham a coluna.', [
    ...dados.grupos.filter(g => g.id !== atual).map(g => ({ texto: esc(g.nome), valor: g.id })),
    { texto: 'Cancelar', valor: null, estilo: 'secundario' },
  ]);
  if (destino) moverCompra(id, destino);
}

async function apagarCompraComPergunta(id) {
  const compra = dados.compras.find(c => c.id === id);
  if (!compra || !(await confirmarApagar(`Apagar “${esc(compra.descricao || compra.descricaoBanco)}”?`, 'Isso não dá pra desfazer.'))) return;
  apagarCompra(id);
  editando = null;
  mostrarTela();
  avisar('Compra apagada');
}

// ---------- Empresas: devoluções e "não vai voltar" ----------

function salvarDevolucao(form) {
  const valor = lerValor(form.elements.valor.value);
  if (!(valor > 0)) {
    avisar('Confere o valor 😉');
    return form.elements.valor.focus();
  }
  const grupo = grupoDe(form.dataset.grupo);
  registrarDevolucao({
    grupoId: grupo.id,
    mes: mesVisivel,
    valor,
    data: form.elements.data.value || hojeISO(),
    observacao: form.elements.observacao.value.trim(),
  });
  devolvendo = null;
  mostrarTela();
  const depois = empresaNoMes(grupo, mesVisivel);
  avisar(depois.falta ? `Devolução registrada ✓ · falta ${real(depois.falta)}` : `Devolução registrada ✓ · ${grupo.nome} devolveu tudo`);
}

async function apagarDevolucaoComPergunta(id) {
  const devolucao = dados.devolucoes.find(d => d.id === id);
  if (!devolucao || !(await confirmarApagar(`Apagar a devolução de ${real(devolucao.valor)}?`, 'O valor volta pro "falta devolver".'))) return;
  apagarDevolucao(id);
  mostrarTela();
  avisar('Devolução apagada');
}

function alternarNaoVolta(tipo, id, naoVolta) {
  marcarNaoVolta(tipo, id, naoVolta);
  mostrarTela();
  avisar(naoVolta ? 'Marcado: não vai voltar' : 'Voltou pro que a empresa devolve');
}

// ---------- Importação ----------

async function lerArquivoEscolhido(arquivos) {
  const imp = importacao;
  const lista = [...arquivos];
  const temImagem = lista.some(ehImagem);
  imp.lendo = temImagem ? 'Lendo os prints…' : 'Lendo o arquivo…';
  imp.erro = '';
  mostrarTela();
  try {
    const { itens, total } = await lerArquivosDeFatura(lista, imp.mes, (n, de) => {
      if (de > 1) { imp.lendo = `Lendo ${temImagem ? 'o print' : 'o arquivo'} ${n} de ${de}…`; mostrarTela(); }
    });
    if (!itens.length) {
      imp.erro = temImagem
        ? 'Não encontrei compras nesses prints. Tentem um print mais nítido, só da lista de compras, ou adicionem na mão.'
        : 'Não encontrei compras nesse arquivo. Confiram se é a fatura certa, ou adicionem as compras na mão.';
    } else {
      const nomeArquivo = lista.length > 1 ? `${lista.length} ${temImagem ? 'prints' : 'arquivos'}` : (temImagem ? 'print' : lista[0].name);
      itens.forEach(aplicarRegra); // descrições padrão primeiro; o que já estava editado na fatura vem por cima
      Object.assign(imp, { etapa: 'revisao', itens, valorBanco: total, nomeArquivo, deImagem: temImagem });
      aplicarFaturaExistente(imp);
    }
  } catch (erro) {
    imp.erro = 'Não consegui ler esse arquivo. Tentem o CSV ou o PDF original do banco, ou adicionem as compras na mão.';
    console.error(erro);
  }
  imp.lendo = false;
  mostrarTela();
}

// Se a fatura escolhida já tem compras, a importação vira "atualizar": troca as compras por padrão,
// mantendo o que vocês já tinham editado nas compras iguais (e marcando as novas)
function aplicarFaturaExistente(imp) {
  const existente = faturaDe(imp.cartaoId, imp.mes);
  const temCompras = existente && comprasDa(existente.id).length > 0;
  imp.itens.forEach(i => { i.nova = false; });
  if (temCompras) aproveitarEdicoes(imp.itens, existente.id);
  imp.substituir = Boolean(temCompras);
}

function linhaEmBranco() {
  const dia = importacao.mes === mesAtual() ? hojeISO() : `${importacao.mes}-01`;
  return novoItem({ data: dia, descricaoBanco: '', valor: 0 });
}

// Guarda no estado da importação o que foi digitado numa linha da revisão (a tela pode ser redesenhada sem perder nada)
function atualizarRevisao(campo) {
  const item = importacao.itens[Number(campo.dataset.i)];
  const nome = campo.dataset.campo;
  if (nome === 'manter') item.manter = campo.checked;
  else if (nome === 'valor') item.valor = lerValorComSinal(campo.value) || 0;
  else if (nome === 'parcelaAtual' || nome === 'parcelaTotal') {
    const linha = campo.closest('.revisao-item');
    const parcela = lerParcelaDosCampos(linha.querySelector('[data-campo="parcelaAtual"]').value, linha.querySelector('[data-campo="parcelaTotal"]').value);
    item.parcela = parcela || null;
    linha.classList.toggle('parcelada', Boolean(parcela));
  } else item[nome] = campo.value;

  campo.closest('.revisao-item').classList.toggle('descartado', !item.manter);
  const total = document.getElementById('detalhado-total');
  if (total) total.textContent = real(soma(importacao.itens.filter(i => i.manter)));
}

function salvarRevisao() {
  const imp = importacao;
  const marcados = imp.itens.filter(i => i.manter);
  const problema = marcados.findIndex(i => !i.data || !i.valor || !(i.descricao.trim() || i.descricaoBanco.trim()));
  if (problema >= 0) {
    const linha = document.querySelectorAll('.revisao-item')[imp.itens.indexOf(marcados[problema])];
    if (linha) linha.scrollIntoView({ block: 'center' });
    return avisar('Tem uma linha sem data, valor ou descrição');
  }
  const aprendidas = marcados.filter(i => i.descricaoBanco && aprender(i.descricaoBanco, i.descricao, i.categoriaId, i.grupoId)).length;
  const fatura = salvarImportacao({ ...imp, origem: imp.nomeArquivo || 'na mão' }); // também salva o que foi aprendido
  importacao = null;
  location.hash = `fatura/${fatura.id}`;
  avisar(`Fatura salva com ${marcados.length} ${marcados.length === 1 ? 'compra' : 'compras'} ✓` +
    (aprendidas ? ` · ${aprendidas} ${aprendidas === 1 ? 'descrição padrão guardada' : 'descrições padrão guardadas'}` : ''));
}

async function apagarDaLista(tipo, id) {
  const lista = tipo === 'grupo' ? dados.grupos : dados.categorias;
  const item = lista.find(i => i.id === id);
  if (!item) return;
  if (tipo === 'grupo' && lista.length === 1) return avisar('Precisa ter pelo menos um grupo');

  const campo = tipo === 'grupo' ? 'grupoId' : 'categoriaId';
  const usos = [...dados.contas, ...dados.compras].filter(c => c[campo] === id).length;
  const destino = tipo === 'grupo' ? lista.find(g => g.id !== id) : null;
  const consequencia = !usos ? 'Nenhuma conta ou compra usa esse item.'
    : tipo === 'grupo' ? `${usos} conta(s) e compra(s) vão passar para "${esc(destino.nome)}".`
    : `${usos} conta(s) e compra(s) vão ficar sem categoria.`;

  const ok = await perguntar(`Apagar “${esc(item.nome)}”?`, consequencia, [
    { texto: 'Apagar', valor: true, estilo: 'perigo' },
    { texto: 'Cancelar', valor: null, estilo: 'secundario' },
  ]);
  if (!ok) return;

  const novoValor = destino ? destino.id : '';
  [...dados.contas, ...dados.compras, ...dados.regras, ...dados.devolucoes, ...dados.series.filter(s => s.tipo === 'conta').map(s => s.modelo)].forEach(c => {
    if (c[campo] === id) c[campo] = novoValor;
  });
  lista.splice(lista.indexOf(item), 1);
  salvar();
  mostrarTela();
}

async function compartilhar() {
  const texto = textoResumo(mesVisivel);
  const celular = matchMedia('(pointer: coarse)').matches;
  if (celular && navigator.share) {
    try {
      await navigator.share({ text: texto });
      return;
    } catch (erro) {
      if (erro.name === 'AbortError') return;
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
}

// ---------- Cliques, digitação e envios ----------

document.addEventListener('click', evento => {
  if (evento.target === janela) return fecharJanela(); // tocou fora do formulário

  const botao = evento.target.closest('[data-acao]');
  if (!botao) return;
  const { acao, id } = botao.dataset;

  switch (acao) {
    case 'mes-anterior': mesVisivel = somarMeses(mesVisivel, -1); return pararDeEditar();
    case 'mes-seguinte': mesVisivel = somarMeses(mesVisivel, 1); return pararDeEditar();
    case 'mes-atual': mesVisivel = mesAtual(); return pararDeEditar();

    case 'nova-conta': return irParaNovo('contas');
    case 'novo-ganho': return irParaNovo('ganhos');
    case 'editar-conta':
    case 'editar-ganho':
    case 'editar-cartao':
    case 'editar-compra':
    case 'editar-regra':
    case 'editar-nota': return editar(id);
    case 'apagar-nota': return apagarNotaComPergunta(id);
    case 'eu-sou': return escolherPessoa(botao.dataset.pessoa);
    case 'trocar-pessoa': return trocarPessoa();
    case 'cancelar-edicao': return pararDeEditar();
    case 'fechar': return fecharJanela();

    case 'pagar': marcar('conta', id, hojeISO()); mostrarTela(); return oferecerComprovante(id); // a janela já diz "Paga ✓"
    case 'ver-comprovante': return verComprovante(id);
    case 'remover-comprovante': return removerComprovante(id);
    case 'desfazer-pagamento': marcar('conta', id, null); mostrarTela(); return avisar('Pagamento desfeito');
    case 'pagar-fatura': atualizarFatura(id, { pagaEm: hojeISO() }); mostrarTela(); return avisar('Fatura paga ✓');
    case 'desfazer-pagamento-fatura': atualizarFatura(id, { pagaEm: null }); mostrarTela(); return avisar('Pagamento desfeito');

    case 'criar-fatura': return criarFatura(id);
    case 'apagar-cartao': return apagarCartaoComPergunta(id);
    case 'apagar-fatura': return apagarFaturaComPergunta(id);
    case 'apagar-compra': return apagarCompraComPergunta(id);
    case 'mover-compra': return moverCompraComPergunta(id);
    case 'apagar-regra': return apagarRegraComPergunta(id);

    case 'devolver': editando = null; devolvendo = id; mostrarTela(); return focarLinha('.linha-devolucao');
    case 'cancelar-devolucao': return pararDeEditar();
    case 'apagar-devolucao': return apagarDevolucaoComPergunta(id);
    case 'nao-volta': return alternarNaoVolta(botao.dataset.tipo, id, true);
    case 'vai-voltar': return alternarNaoVolta(botao.dataset.tipo, id, false);

    case 'importar-na-mao': Object.assign(importacao, { etapa: 'revisao', itens: [linhaEmBranco()], erro: '' }); mostrarTela(); return focarLinha('.revisao-item:last-child .r-desc');
    case 'importar-adicionar-linha': importacao.itens.push(linhaEmBranco()); mostrarTela(); return focarLinha('.revisao-item:last-child .r-desc');
    case 'importar-remover': importacao.itens.splice(Number(botao.dataset.i), 1); return mostrarTela();
    case 'importar-salvar': return salvarRevisao();
    case 'importar-cancelar': importacao = null; location.hash = 'cartoes'; return;
    case 'receber': marcar('ganho', id, hojeISO()); mostrarTela(); return avisar('Recebido ✓');
    case 'desfazer-recebimento': marcar('ganho', id, null); mostrarTela(); return avisar('Recebimento desfeito');

    case 'apagar-conta': return apagarItem('conta', id);
    case 'apagar-ganho': return apagarItem('ganho', id);
    case 'apagar-categoria': return apagarDaLista('categoria', id);
    case 'apagar-grupo': return apagarDaLista('grupo', id);

    case 'compartilhar': return compartilhar();
    case 'apagar-tudo': return apagarTudo();
  }
});

async function apagarTudo() {
  const ok = await perguntar('Apagar tudo?', 'Todos os ganhos, contas e ajustes deste navegador vão sumir. Isso não dá pra desfazer.', [
    { texto: 'Apagar tudo', valor: true, estilo: 'perigo' },
    { texto: 'Cancelar', valor: null, estilo: 'secundario' },
  ]);
  if (!ok) return;
  const nomes = dados.casal;
  dados = dadosIniciais();
  dados.casal = nomes;
  await salvar(); // apaga tudo do cofre na nuvem e recria os padrões
  location.hash = 'inicio';
  mostrarTela();
  avisar('Tudo apagado. Começando do zero!');
}

document.addEventListener('change', evento => {
  const campo = evento.target;

  if (campo.dataset.ajuste) {
    dados.casal[campo.dataset.ajuste] = campo.value.trim() || (campo.dataset.ajuste === 'pessoa1' ? 'Pessoa 1' : 'Pessoa 2');
    return salvar();
  }
  if (campo.dataset.renomear) {
    const lista = campo.dataset.renomear === 'grupo' ? dados.grupos : dados.categorias;
    const item = lista.find(i => i.id === campo.dataset.id);
    if (campo.value.trim()) item.nome = campo.value.trim();
    else campo.value = item.nome;
    return salvar();
  }
  if ('empresa' in campo.dataset) {
    dados.grupos.find(g => g.id === campo.dataset.id).empresa = campo.checked;
    return salvar();
  }

  // Foto do comprovante escolhida (ou tirada na hora)
  if ('comprovante' in campo.dataset && campo.files.length) return anexarComprovante(campo.dataset.comprovante, campo.files[0]);

  // Importação: arquivo escolhido, cartão/mês/valor do banco, e as linhas da revisão
  if ('importarArquivo' in campo.dataset && campo.files.length) return lerArquivoEscolhido(campo.files);
  if (campo.dataset.importar && importacao) {
    const nome = campo.dataset.importar;
    if (nome === 'valorBanco') return void (importacao.valorBanco = campo.value.trim() ? (lerValor(campo.value) || null) : null);
    if (nome === 'substituir') importacao.substituir = campo.checked;
    else {
      importacao[nome] = campo.value;
      // trocar cartão/mês pode cair numa fatura que já tem compras
      if (importacao.etapa === 'revisao') aplicarFaturaExistente(importacao);
    }
    return mostrarTela();
  }
  if (campo.dataset.campo && importacao) return atualizarRevisao(campo);
});

// Arrastar compra de uma coluna pra outra (no computador)
document.addEventListener('dragstart', evento => {
  const item = evento.target.closest && evento.target.closest('[data-arrastar]');
  if (!item) return;
  evento.dataTransfer.setData('text/plain', item.dataset.arrastar);
  evento.dataTransfer.effectAllowed = 'move';
  item.classList.add('arrastando');
  document.querySelectorAll('[data-coluna]').forEach(c => c.classList.add('pode-soltar'));
});

document.addEventListener('dragover', evento => {
  const coluna = evento.target.closest && evento.target.closest('[data-coluna]');
  if (!coluna) return;
  evento.preventDefault();
  evento.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('[data-coluna].alvo').forEach(c => c !== coluna && c.classList.remove('alvo'));
  coluna.classList.add('alvo');
});

document.addEventListener('drop', evento => {
  const coluna = evento.target.closest && evento.target.closest('[data-coluna]');
  if (!coluna) return;
  evento.preventDefault();
  moverCompra(evento.dataTransfer.getData('text/plain'), coluna.dataset.coluna);
});

document.addEventListener('dragend', () => {
  document.querySelectorAll('.arrastando, .alvo, .pode-soltar').forEach(el => el.classList.remove('arrastando', 'alvo', 'pode-soltar'));
});

// Nas linhas da revisão, guarda enquanto digita (não só ao sair do campo)
document.addEventListener('input', evento => {
  const campo = evento.target;
  if ('filtroRegras' in campo.dataset) {
    const busca = chaveTexto(campo.value);
    document.querySelectorAll('.lista-regras li[data-busca]').forEach(li => { li.hidden = busca && !li.dataset.busca.includes(busca); });
    return;
  }
  if (campo.dataset.campo && importacao && campo.type !== 'checkbox' && campo.tagName === 'INPUT') atualizarRevisao(campo);
});

document.addEventListener('submit', evento => {
  const form = evento.target;
  const tipo = form.dataset.form;
  if (!tipo) return;
  evento.preventDefault();

  if (tipo === 'conta' || tipo === 'ganho') return salvarFormulario(form);
  if (tipo === 'cartao') return salvarCartao(form);
  if (tipo === 'compra') return salvarCompra(form);
  if (tipo === 'valor-banco') return salvarValorBanco(form);
  if (tipo === 'transformar') return transformar(form);
  if (tipo === 'regra') return salvarRegraDoFormulario(form);
  if (tipo === 'devolucao') return salvarDevolucao(form);
  if (tipo === 'nota') return salvarNota(form);

  const nome = form.elements.nome.value.trim();
  if (!nome) return;
  if (tipo === 'nova-categoria') dados.categorias.push({ id: novoId(), nome });
  if (tipo === 'novo-grupo') dados.grupos.push({ id: novoId(), nome, empresa: false });
  salvar();
  mostrarTela();
});

// Esc fecha a edição sem salvar
document.addEventListener('keydown', evento => {
  if (evento.key !== 'Escape') return;
  if (editando && evento.target.closest(`.linha-form[data-id="${editando}"]`)) pararDeEditar();
  if (devolvendo && evento.target.closest('.linha-devolucao')) pararDeEditar();
});

// Os dados agora moram no Supabase: ao recarregar o app em qualquer aparelho, vêm de lá.
// (Atualização "ao vivo" na tela do outro, sem recarregar, fica pra uma melhoria futura.)

window.addEventListener('hashchange', pararDeEditar);

// O app agora começa pelo portão de entrada (login). Quem decide abrir é o auth.js.
iniciarApp();
