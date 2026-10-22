// Nosso Mês — a ponte entre o app e o Supabase.
// O app trabalha com os dados na memória (o objeto `dados`, sempre em "camelCase").
// Aqui a gente: (1) lê tudo ao abrir e monta esse objeto; (2) grava cada mudança
// de volta, comparando o que mudou e mandando só isso pras tabelas certas.
// As tabelas usam "snake_case" e valores em centavos — a tradução acontece aqui.

// ---------- Traduzir do banco (snake_case) pro app (camelCase) ----------

const cent = v => (v == null ? 0 : Number(v)); // centavos sempre como número

function deCategoria(r) { return { id: r.id, nome: r.nome }; }
function deGrupo(r) { return { id: r.id, nome: r.nome, empresa: !!r.empresa }; }
function deSerie(r) { return { id: r.id, tipo: r.tipo, inicio: r.inicio, fim: r.fim, pulados: r.pulados || [], modelo: r.modelo || {} }; }
function deCartao(r) { return { id: r.id, nome: r.nome, banco: r.banco, titular: r.titular, fechamento: r.fechamento, vencimento: r.vencimento }; }
function deFatura(r) { return { id: r.id, cartaoId: r.cartao_id, mes: r.mes, valorBanco: r.valor_banco == null ? null : cent(r.valor_banco), pagaEm: r.paga_em, historico: r.historico || [] }; }
function deRegra(r) { return { id: r.id, texto: r.texto, descricao: r.descricao || '', categoriaId: r.categoria_id || '', grupoId: r.grupo_id || '', origem: r.origem, em: r.em }; }
function deGanho(r) { return { id: r.id, mes: r.mes, serieId: r.serie_id, descricao: r.descricao, valor: cent(r.valor), pessoa: r.pessoa, observacao: r.observacao || '', recebidoEm: r.recebido_em }; }
function deConta(r) { return { id: r.id, mes: r.mes, serieId: r.serie_id, nome: r.nome, valor: cent(r.valor), dia: r.dia, categoriaId: r.categoria_id || '', grupoId: r.grupo_id || '', pagaEm: r.paga_em, naoVolta: !!r.nao_volta }; }
function deCompra(r) {
  return {
    id: r.id, faturaId: r.fatura_id, data: r.data, descricaoBanco: r.descricao_banco || '', descricao: r.descricao || '',
    valor: cent(r.valor), categoriaId: r.categoria_id || '', grupoId: r.grupo_id || '',
    parcela: (r.parcela_atual && r.parcela_total) ? { atual: r.parcela_atual, total: r.parcela_total } : null,
    naoVolta: !!r.nao_volta,
  };
}
function deDevolucao(r) { return { id: r.id, grupoId: r.grupo_id, mes: r.mes, valor: cent(r.valor), data: r.data, observacao: r.observacao || '' }; }

// ---------- Traduzir do app pro banco (e carimbar o casal_id) ----------

const ouNulo = v => (v === '' || v === undefined ? null : v); // "sem categoria/grupo" vira NULL no banco

function paraCategoria(c) { return { id: c.id, casal_id: casalId, nome: c.nome }; }
function paraGrupo(g) { return { id: g.id, casal_id: casalId, nome: g.nome, empresa: !!g.empresa }; }
function paraSerie(s) { return { id: s.id, casal_id: casalId, tipo: s.tipo, inicio: s.inicio, fim: s.fim || null, pulados: s.pulados || [], modelo: s.modelo || {} }; }
function paraCartao(c) { return { id: c.id, casal_id: casalId, nome: c.nome, banco: c.banco || null, titular: c.titular || null, fechamento: c.fechamento ?? null, vencimento: c.vencimento ?? null }; }
function paraFatura(f) { return { id: f.id, casal_id: casalId, cartao_id: f.cartaoId, mes: f.mes, valor_banco: f.valorBanco ?? null, paga_em: f.pagaEm || null, historico: f.historico || [] }; }
function paraRegra(r) { return { id: r.id, casal_id: casalId, texto: r.texto, descricao: r.descricao || '', categoria_id: ouNulo(r.categoriaId), grupo_id: ouNulo(r.grupoId), origem: r.origem || 'cadastrada', em: r.em || null }; }
function paraGanho(g) { return { id: g.id, casal_id: casalId, mes: g.mes, serie_id: ouNulo(g.serieId), descricao: g.descricao || '', valor: g.valor || 0, pessoa: g.pessoa || null, observacao: g.observacao || null, recebido_em: g.recebidoEm || null }; }
function paraConta(c) { return { id: c.id, casal_id: casalId, mes: c.mes, serie_id: ouNulo(c.serieId), nome: c.nome || '', valor: c.valor || 0, dia: c.dia ?? null, categoria_id: ouNulo(c.categoriaId), grupo_id: ouNulo(c.grupoId), paga_em: c.pagaEm || null, nao_volta: !!c.naoVolta }; }
function paraCompra(c) {
  return {
    id: c.id, casal_id: casalId, fatura_id: c.faturaId, data: c.data || null, descricao_banco: c.descricaoBanco || null,
    descricao: c.descricao || null, valor: c.valor || 0, categoria_id: ouNulo(c.categoriaId), grupo_id: ouNulo(c.grupoId),
    parcela_atual: c.parcela ? c.parcela.atual : null, parcela_total: c.parcela ? c.parcela.total : null, nao_volta: !!c.naoVolta,
  };
}
function paraDevolucao(d) { return { id: d.id, casal_id: casalId, grupo_id: d.grupoId, mes: d.mes, valor: d.valor || 0, data: d.data || null, observacao: d.observacao || null }; }

// Cada gaveta: [nome no banco, pega a lista no `dados`, tradutor pro banco].
// A ORDEM importa: pais antes dos filhos (ao gravar) e o contrário (ao apagar).
const GAVETAS = [
  ['categorias', () => dados.categorias, paraCategoria],
  ['grupos', () => dados.grupos, paraGrupo],
  ['series', () => dados.series, paraSerie],
  ['cartoes', () => dados.cartoes, paraCartao],
  ['faturas', () => dados.faturas, paraFatura],
  ['regras', () => dados.regras, paraRegra],
  ['ganhos', () => dados.ganhos, paraGanho],
  ['contas', () => dados.contas, paraConta],
  ['compras', () => dados.compras, paraCompra],
  ['devolucoes', () => dados.devolucoes, paraDevolucao],
];

// ---------- Ler tudo ao abrir ----------

async function carregarDoSupabase() {
  const r = await Promise.all(GAVETAS.map(([nome]) => sb.from(nome).select('*')));
  const falhou = r.find(x => x.error);
  if (falhou) throw falhou.error;

  const [cat, gru, ser, car, fat, reg, gan, con, com, dev] = r.map(x => x.data || []);
  dados = {
    casal: { pessoa1: (cofre && cofre.nome_pessoa1) || 'Pessoa 1', pessoa2: (cofre && cofre.nome_pessoa2) || 'Pessoa 2' },
    categorias: cat.map(deCategoria),
    grupos: gru.map(deGrupo),
    series: ser.map(deSerie),
    cartoes: car.map(deCartao),
    faturas: fat.map(deFatura),
    regras: reg.map(deRegra),
    ganhos: gan.map(deGanho),
    contas: con.map(deConta),
    compras: com.map(deCompra),
    devolucoes: dev.map(deDevolucao),
  };

  reiniciarSnapshot();

  // Cofre novo e sem categorias/grupos? Semeia os padrões (uma vez) e grava.
  if (!dados.categorias.length && !dados.grupos.length) {
    const padrao = dadosIniciais();
    dados.categorias = padrao.categorias;
    dados.grupos = padrao.grupos;
    await sincronizar();
  }
}

// ---------- A "foto" do que já está gravado (pra saber o que mudou) ----------

let retrato = {};
let retratoCasal = '';

function reiniciarSnapshot() {
  retrato = {};
  for (const [nome, pegar] of GAVETAS) {
    const mapa = new Map();
    for (const item of pegar()) mapa.set(item.id, JSON.stringify(item));
    retrato[nome] = mapa;
  }
  retratoCasal = JSON.stringify(dados.casal);
}

// ---------- Gravar: compara com a foto e manda só o que mudou ----------

async function sincronizar() {
  const gravar = []; // [{ nome, linhas }]
  const apagar = []; // [{ nome, ids }]

  for (const [nome, pegar, paraBanco] of GAVETAS) {
    const foto = retrato[nome] || new Map();
    const atuais = pegar();
    const idsAgora = new Set(atuais.map(i => i.id));
    const mudados = atuais.filter(i => foto.get(i.id) !== JSON.stringify(i));
    const sumidos = [...foto.keys()].filter(id => !idsAgora.has(id));
    if (mudados.length) gravar.push({ nome, linhas: mudados.map(paraBanco) });
    if (sumidos.length) apagar.push({ nome, ids: sumidos });
  }

  // Gravar (novos + mudados), pais antes dos filhos
  for (const g of gravar) {
    const { error } = await sb.from(g.nome).upsert(g.linhas);
    if (error) throw error;
  }

  // Nomes do casal (fica na tabela do cofre)
  if (JSON.stringify(dados.casal) !== retratoCasal && casalId) {
    const { error } = await sb.from('casais')
      .update({ nome_pessoa1: dados.casal.pessoa1, nome_pessoa2: dados.casal.pessoa2 })
      .eq('id', casalId);
    if (error) throw error;
    if (cofre) { cofre.nome_pessoa1 = dados.casal.pessoa1; cofre.nome_pessoa2 = dados.casal.pessoa2; }
  }

  // Apagar, filhos antes dos pais (ordem inversa)
  for (let i = apagar.length - 1; i >= 0; i--) {
    const { error } = await sb.from(apagar[i].nome).delete().in('id', apagar[i].ids);
    if (error) throw error;
  }

  reiniciarSnapshot(); // deu tudo certo: a nova foto é o estado atual
}

// ---------- salvar(): o app chama isso a cada mudança ----------
// É sem espera (não trava a tela) e nunca atropela: se já está gravando, enfileira.

let gravando = false;
let temMaisPraGravar = false;

async function salvar() {
  if (!casalId) return; // ainda não entrou no cofre: nada a gravar
  temMaisPraGravar = true;
  if (gravando) return;
  gravando = true;
  try {
    while (temMaisPraGravar) {
      temMaisPraGravar = false;
      await sincronizar();
    }
  } catch (erro) {
    temMaisPraGravar = true; // tenta de novo na próxima mudança
    console.error('Erro ao salvar no Supabase:', erro);
    avisar('Não consegui salvar na nuvem agora 😕');
  } finally {
    gravando = false;
  }
}

// ---------- Trazer os dados de teste do navegador pro banco (uma vez) ----------

// Lê o que ficou salvo no navegador (do jeito antigo). Devolve os dados, ou null se não houver nada útil.
function dadosAntigosNoNavegador() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const d = JSON.parse(bruto);
    const qtd = (d.ganhos || []).length + (d.contas || []).length + (d.cartoes || []).length + (d.compras || []).length;
    return qtd > 0 ? d : null;
  } catch (e) {
    return null;
  }
}

// Substitui o conteúdo do cofre pelos dados de teste do navegador e grava no Supabase.
async function migrarDoNavegador(antigo) {
  dados = {
    casal: antigo.casal || dados.casal,
    categorias: antigo.categorias || [],
    grupos: antigo.grupos || [],
    series: antigo.series || [],
    cartoes: antigo.cartoes || [],
    faturas: antigo.faturas || [],
    regras: antigo.regras || [],
    ganhos: antigo.ganhos || [],
    contas: antigo.contas || [],
    compras: antigo.compras || [],
    devolucoes: antigo.devolucoes || [],
  };
  await salvar(); // compara com o cofre atual: apaga os padrões vazios e insere os dados de teste
}

// Oferece a migração uma única vez (guarda um aviso no navegador pra não perguntar de novo).
async function oferecerMigracao() {
  if (localStorage.getItem('nosso-mes:migrado')) return;
  const antigo = dadosAntigosNoNavegador();
  if (!antigo) { localStorage.setItem('nosso-mes:migrado', '1'); return; }

  const qtd = (antigo.ganhos || []).length + (antigo.contas || []).length + (antigo.cartoes || []).length + (antigo.compras || []).length;
  const escolha = await perguntar(
    'Trazer seus dados de teste?',
    `Encontrei dados de teste salvos neste navegador (${qtd} itens). Quer que eu leve eles pro banco de verdade, pra não perder? Isso vai substituir o que está no cofre agora pelos seus dados de teste.`,
    [
      { texto: 'Sim, trazer pro banco', valor: 'sim' },
      { texto: 'Não, começar limpo', valor: 'nao', estilo: 'secundario' },
    ]
  );
  localStorage.setItem('nosso-mes:migrado', '1'); // decidiu: não pergunta mais
  if (escolha !== 'sim') return;

  try {
    await migrarDoNavegador(antigo);
    mostrarTela();
    avisar('Dados de teste trazidos pro banco ✓');
  } catch (erro) {
    console.error('Erro ao migrar:', erro);
    avisar('Não consegui trazer os dados agora 😕');
  }
}
