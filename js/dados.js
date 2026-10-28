// Nosso Mês — onde os dados moram (no navegador, por enquanto) e as contas que o app faz.
// Valores são guardados em centavos (número inteiro) pra não ter erro de arredondamento.

const CHAVE = 'nosso-mes:v1';

function novoId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function dadosIniciais() {
  const categorias = ['Mercado', 'Casa', 'Contas fixas', 'Cartão', 'Carro', 'Restaurante', 'Lazer', 'Transporte', 'Saúde', 'Compras', 'Outros'];
  return {
    casal: { pessoa1: 'Eduarda', pessoa2: 'Lucas' },
    categorias: categorias.map(nome => ({ id: novoId(), nome })),
    grupos: [
      { id: novoId(), nome: 'Nosso', empresa: false },
      { id: novoId(), nome: 'Eventique', empresa: true },
      { id: novoId(), nome: 'Loja', empresa: true },
    ],
    ganhos: [],
    contas: [],
    // Itens que repetem todo mês: { id, tipo: 'ganho' | 'conta', inicio, fim, pulados: [meses], modelo }
    series: [],
    ...partesDosCartoes(),
  };
}

// Cartão: { id, nome, banco, titular: 'p1' | 'p2', fechamento, vencimento }
// Fatura: { id, cartaoId, mes (em que vence), valorBanco (null = usa o detalhado), pagaEm }
// Compra: { id, faturaId, data, descricaoBanco, descricao, valor, categoriaId, grupoId, parcela: { atual, total } | null }
// Descrição padrão: { id, texto (o que o banco escreve; vale se a descrição do banco "contém" isso),
//   descricao ('' = não muda), categoriaId ('' = não muda), grupoId ('' = não muda), origem: 'aprendida' | 'cadastrada', em }
// Devolução: { id, grupoId (a empresa), mes, valor, data, observacao }
// Contas e compras de empresa podem ter naoVolta: true (a empresa não vai devolver aquele gasto)
function partesDosCartoes() {
  return { cartoes: [], faturas: [], compras: [], regras: [], devolucoes: [] };
}

// Os dados moram na memória (o objeto `dados`). Quem lê tudo ao abrir e grava cada
// mudança de verdade — agora no Supabase — é o dados-nuvem.js (carregarDoSupabase e salvar).
// Começa vazio; o carregarDoSupabase() preenche assim que a pessoa entra no cofre.
let dados = dadosIniciais();

// ---------- Meses e datas (mês = "2026-10", data = "2026-10-05") ----------

function mesDe(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

function mesAtual() {
  return mesDe(new Date());
}

function hojeISO() {
  const hoje = new Date();
  return `${mesDe(hoje)}-${String(hoje.getDate()).padStart(2, '0')}`;
}

function somarMeses(mes, quantos) {
  const [ano, m] = mes.split('-').map(Number);
  return mesDe(new Date(ano, m - 1 + quantos, 1));
}

function nomeDoMes(mes, comAno = true) {
  const [ano, m] = mes.split('-').map(Number);
  const nome = new Date(ano, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
  return comAno ? `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${ano}` : nome;
}

// ---------- Dinheiro ----------

const formatoReal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function real(centavos) {
  return formatoReal.format(centavos / 100);
}

// Aceita "1.579,16", "1579,16", "1579.16", "2.000" e "R$ 42,30"
function lerValor(texto) {
  let limpo = String(texto).replace(/[^\d.,]/g, '');
  if (limpo.includes(',')) limpo = limpo.replace(/\./g, '').replace(',', '.');
  else if (/\.\d{3}$/.test(limpo)) limpo = limpo.replace(/\./g, '');
  const numero = Number(limpo);
  return limpo && Number.isFinite(numero) ? Math.round(numero * 100) : NaN;
}

function valorParaCampo(centavos) {
  return (centavos / 100).toFixed(2).replace('.', ',');
}

// ---------- Adicionar, mudar e apagar ----------

function listaDo(tipo) {
  return tipo === 'ganho' ? dados.ganhos : dados.contas;
}

function adicionar(tipo, campos, mes, repete) {
  const item = { ...campos, id: novoId(), mes, serieId: null };
  if (repete) {
    const modelo = { ...campos };
    delete modelo.pagaEm;
    delete modelo.recebidoEm;
    const serie = { id: novoId(), tipo, inicio: mes, fim: null, pulados: [], modelo };
    dados.series.push(serie);
    item.serieId = serie.id;
  }
  listaDo(tipo).push(item);
  salvar();
}

function atualizar(tipo, id, campos) {
  const item = listaDo(tipo).find(i => i.id === id);
  if (item) Object.assign(item, campos);
  salvar();
}

function marcar(tipo, id, data) {
  atualizar(tipo, id, tipo === 'conta' ? { pagaEm: data } : { recebidoEm: data });
}

// Apaga um item. Se ele repete todo mês, dá pra apagar só este mês ou este e os próximos.
function apagar(tipo, id, tambemProximos) {
  const lista = listaDo(tipo);
  const item = lista.find(i => i.id === id);
  if (!item) return;
  const serie = item.serieId && dados.series.find(s => s.id === item.serieId);

  if (serie && tambemProximos) {
    serie.fim = somarMeses(item.mes, -1);
    for (let i = lista.length - 1; i >= 0; i--) {
      if (lista[i].serieId === serie.id && lista[i].mes >= item.mes) lista.splice(i, 1);
    }
    if (serie.fim < serie.inicio) dados.series = dados.series.filter(s => s !== serie);
  } else {
    if (serie) serie.pulados.push(item.mes);
    lista.splice(lista.indexOf(item), 1);
  }
  salvar();
}

// Cria os itens que repetem todo mês, do começo de cada série até o mês pedido
function prepararAte(mesFinal) {
  let criou = false;
  for (const serie of dados.series) {
    const lista = listaDo(serie.tipo);
    for (let mes = serie.inicio; mes <= mesFinal && (!serie.fim || mes <= serie.fim); mes = somarMeses(mes, 1)) {
      if (serie.pulados.includes(mes)) continue;
      if (lista.some(item => item.serieId === serie.id && item.mes === mes)) continue;
      lista.push({ ...serie.modelo, id: novoId(), serieId: serie.id, mes });
      criou = true;
    }
  }
  if (criou) salvar();
}

// ---------- As contas que o app faz ----------

function soma(itens) {
  return itens.reduce((total, item) => total + item.valor, 0);
}

function vencimentoDe(conta) {
  const [ano, m] = conta.mes.split('-').map(Number);
  const ultimoDia = new Date(ano, m, 0).getDate();
  return `${conta.mes}-${String(Math.min(conta.dia, ultimoDia)).padStart(2, '0')}`;
}

function estaVencida(conta) {
  return !conta.pagaEm && vencimentoDe(conta) < hojeISO();
}

function porVencimento(a, b) {
  return vencimentoDe(a).localeCompare(vencimentoDe(b)) || a.nome.localeCompare(b.nome);
}

// "Pagáveis" = contas + faturas, no mesmo formato ({ tipo, id, nome, valor, dia, mes, pagaEm }),
// pra entrarem juntas na folga, nas vencidas, nas próximas e no Compartilhar
function pagaveis(mes) {
  const contas = dados.contas.map(c => ({ ...c, tipo: 'conta' }));
  const faturas = dados.faturas.map(faturaComoConta).filter(Boolean);
  const todos = [...contas, ...faturas];
  return mes ? todos.filter(p => p.mes === mes) : todos;
}

// A folga conta o que as empresas vão devolver no mês (o que já voltou + o que falta), como os ganhos previstos:
// marcar "Devolveu" não muda a folga; só o que "não vai voltar" sai da conta.
function resumoDoMes(mes) {
  const ganhos = dados.ganhos.filter(g => g.mes === mes);
  const contas = dados.contas.filter(c => c.mes === mes);
  const doMes = pagaveis(mes);
  const empresas = empresasDoMes(mes);
  const entra = soma(ganhos);
  const reembolso = empresas.reduce((total, e) => total + e.aReceber, 0);
  const sai = soma(doMes);
  return {
    ganhos,
    contas,
    pagaveis: doMes,
    empresas,
    entra,
    reembolso,
    sai,
    recebido: soma(ganhos.filter(g => g.recebidoEm)),
    devolvido: empresas.reduce((total, e) => total + Math.min(e.devolvido, e.aReceber), 0),
    pago: soma(doMes.filter(c => c.pagaEm)),
    folga: entra + reembolso - sai,
  };
}

// Quanto sai em cada categoria no mês, da maior pra menor: contas + compras das faturas que vencem no mês.
// O que o banco cobra a mais do que foi detalhado entra como "Cartão (sem detalhe)", pra fechar com o total que sai.
function porCategoria(mes) {
  const totais = new Map();
  const somar = (nome, valor) => totais.set(nome, (totais.get(nome) || 0) + valor);
  for (const conta of dados.contas.filter(c => c.mes === mes)) somar(nomeCategoria(conta.categoriaId), conta.valor);
  for (const fatura of dados.faturas.filter(f => f.mes === mes && cartaoDe(f.cartaoId))) {
    for (const compra of comprasDa(fatura.id)) somar(nomeCategoria(compra.categoriaId), compra.valor);
    const semDetalhe = valorDaFatura(fatura) - detalhadoDa(fatura);
    if (semDetalhe > 0) somar('Cartão (sem detalhe)', semDetalhe);
  }
  return [...totais].map(([nome, valor]) => ({ nome, valor })).filter(c => c.valor > 0).sort((a, b) => b.valor - a.valor);
}

// Vencidas do mês visto; no mês atual, também as esquecidas de meses anteriores
function vencidasPara(mes) {
  const incluiAnteriores = mes === mesAtual();
  return pagaveis()
    .filter(c => estaVencida(c) && (c.mes === mes || (incluiAnteriores && c.mes < mes)))
    .sort(porVencimento);
}

function textoResumo(mes) {
  const r = resumoDoMes(mes);
  // Um tópico por linha. Os asteriscos viram negrito no WhatsApp.
  const listar = contas => contas.map(c => `• ${c.nome} — ${real(c.valor)} · dia ${c.dia}`);
  const blocos = [
    [
      `📅 *Nosso Mês · ${nomeDoMes(mes, false)}*`,
      r.folga >= 0 ? `✅ Ainda podemos gastar ${real(r.folga)}` : `🔴 Passamos ${real(-r.folga)} do que ganhamos`,
    ],
  ];

  const faltam = r.pagaveis.filter(c => !c.pagaEm && !estaVencida(c)).sort(porVencimento);
  if (faltam.length) blocos.push([`🧾 *Faltam pagar*`, ...listar(faltam)]);

  const vencidas = vencidasPara(mes);
  if (vencidas.length) blocos.push([`⚠️ *${vencidas.length > 1 ? 'Vencidas' : 'Vencida'}*`, ...listar(vencidas)]);

  // Total geral: o que falta pagar mais o que já venceu
  if (faltam.length || vencidas.length) blocos.push([`💸 *Total que ainda falta pagar: ${real(soma(faltam) + soma(vencidas))}*`]);

  const pagas = r.pagaveis.filter(c => c.pagaEm).sort(porVencimento);
  if (pagas.length) blocos.push([`✅ *Já pagas*`, ...listar(pagas), `💚 *Total pago: ${real(soma(pagas))}*`]);

  if (r.recebido < r.entra) blocos.push([`💰 *Ainda falta receber*`, `• ${real(r.entra - r.recebido)}`]);

  const devendo = r.empresas.filter(e => e.falta > 0);
  if (devendo.length) blocos.push([`🏢 *Falta voltar das empresas*`, ...devendo.map(e => `• ${e.nome} — ${real(e.falta)}`)]);

  return blocos.map(linhas => linhas.join('\n')).join('\n\n');
}

// ---------- Nomes ----------

function nomePessoa(chave) {
  if (chave === 'p1') return dados.casal.pessoa1;
  if (chave === 'p2') return dados.casal.pessoa2;
  return 'Os dois';
}

function nomeCategoria(id) {
  const categoria = dados.categorias.find(c => c.id === id);
  return categoria ? categoria.nome : 'Sem categoria';
}

function grupoDe(id) {
  return dados.grupos.find(g => g.id === id);
}

// Compras sem grupo (ou com grupo apagado) contam como do primeiro grupo, o "Nosso"
function grupoDaCompra(compra) {
  return grupoDe(compra.grupoId) || dados.grupos[0];
}

// Pra comparar nomes sem ligar pra maiúscula, acento e espaços: "Nubank  Lucas" = "nubank lucas"
function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// ---------- Cartões e faturas ----------

function cartaoDe(id) {
  return dados.cartoes.find(c => c.id === id);
}

function faturaDe(cartaoId, mes) {
  return dados.faturas.find(f => f.cartaoId === cartaoId && f.mes === mes);
}

function comprasDa(faturaId) {
  return dados.compras.filter(c => c.faturaId === faturaId);
}

function detalhadoDa(fatura) {
  return soma(comprasDa(fatura.id));
}

// A folga usa o que o banco cobra; sem esse valor digitado, usa a soma das compras
function valorDaFatura(fatura) {
  return fatura.valorBanco != null ? fatura.valorBanco : detalhadoDa(fatura);
}

function faturaComoConta(fatura) {
  const cartao = cartaoDe(fatura.cartaoId);
  if (!cartao) return null;
  return { tipo: 'fatura', id: fatura.id, nome: cartao.nome, valor: valorDaFatura(fatura), dia: cartao.vencimento, mes: fatura.mes, pagaEm: fatura.pagaEm };
}

function garantirFatura(cartaoId, mes) {
  let fatura = faturaDe(cartaoId, mes);
  if (!fatura) {
    fatura = { id: novoId(), cartaoId, mes, valorBanco: null, pagaEm: null };
    dados.faturas.push(fatura);
  }
  return fatura;
}

function atualizarFatura(id, campos) {
  const fatura = dados.faturas.find(f => f.id === id);
  if (fatura) Object.assign(fatura, campos);
  salvar();
}

function apagarFatura(id) {
  dados.faturas = dados.faturas.filter(f => f.id !== id);
  dados.compras = dados.compras.filter(c => c.faturaId !== id);
  salvar();
}

function adicionarCartao(campos) {
  dados.cartoes.push({ ...campos, id: novoId() });
  salvar();
}

function atualizarCartao(id, campos) {
  Object.assign(cartaoDe(id), campos);
  salvar();
}

// Apagar um cartão leva junto as faturas e as compras dele
function apagarCartao(id) {
  const faturas = new Set(dados.faturas.filter(f => f.cartaoId === id).map(f => f.id));
  dados.cartoes = dados.cartoes.filter(c => c.id !== id);
  dados.faturas = dados.faturas.filter(f => !faturas.has(f.id));
  dados.compras = dados.compras.filter(c => !faturas.has(c.faturaId));
  salvar();
}

function adicionarCompra(faturaId, campos) {
  dados.compras.push({ ...campos, id: novoId(), faturaId });
  salvar();
}

function atualizarCompra(id, campos) {
  Object.assign(dados.compras.find(c => c.id === id), campos);
  salvar();
}

function apagarCompra(id) {
  dados.compras = dados.compras.filter(c => c.id !== id);
  salvar();
}

// Resumo da fatura em colunas, como na planilha: uma por grupo (Nosso · Eventique · Loja)
function colunasDaFatura(faturaId) {
  const compras = comprasDa(faturaId);
  return dados.grupos.map(grupo => {
    const doGrupo = compras.filter(c => grupoDaCompra(c).id === grupo.id).sort((a, b) => a.data.localeCompare(b.data));
    return { grupo, compras: doGrupo, total: soma(doGrupo) };
  });
}

// Quanto das saídas do mês é das empresas: contas + compras das faturas que vencem no mês
function empresasNoMes(mes) {
  return empresasDoMes(mes).filter(e => e.gasto !== 0).map(e => ({ nome: e.nome, valor: e.gasto }));
}

// ---------- Empresas e reembolso ----------

// Tudo o que a empresa gastou do dinheiro de vocês no mês: as contas do grupo dela
// + as compras dela nas faturas que vencem no mês (o dinheiro sai no mês em que a fatura vence)
function itensDaEmpresa(grupoId, mes) {
  const contas = dados.contas.filter(c => c.mes === mes && c.grupoId === grupoId).map(c => ({
    tipo: 'conta', id: c.id, nome: c.nome, valor: c.valor, origem: `Conta · dia ${c.dia}`, naoVolta: Boolean(c.naoVolta),
  }));
  const compras = [];
  for (const fatura of dados.faturas.filter(f => f.mes === mes)) {
    const cartao = cartaoDe(fatura.cartaoId);
    if (!cartao) continue;
    for (const c of comprasDa(fatura.id)) {
      if (grupoDaCompra(c).id !== grupoId) continue;
      compras.push({
        tipo: 'compra', id: c.id, nome: c.descricao || c.descricaoBanco, valor: c.valor,
        origem: `${cartao.nome} · ${c.data.slice(8, 10)}/${c.data.slice(5, 7)}`, naoVolta: Boolean(c.naoVolta), faturaId: fatura.id,
      });
    }
  }
  return [...contas, ...compras.sort((a, b) => a.origem.localeCompare(b.origem))];
}

// O resumo de uma empresa no mês: quanto gastou, quanto vai voltar, quanto já voltou e quanto falta
function empresaNoMes(grupo, mes) {
  const itens = itensDaEmpresa(grupo.id, mes);
  const devolucoes = dados.devolucoes.filter(d => d.grupoId === grupo.id && d.mes === mes).sort((a, b) => a.data.localeCompare(b.data));
  const gasto = soma(itens);
  const naoVolta = soma(itens.filter(i => i.naoVolta));
  const aReceber = Math.max(0, gasto - naoVolta);
  const devolvido = soma(devolucoes);
  return {
    grupo, nome: grupo.nome, itens, devolucoes, gasto, naoVolta, aReceber, devolvido,
    falta: Math.max(0, aReceber - devolvido),
    aMais: Math.max(0, devolvido - aReceber),
  };
}

function empresasDoMes(mes) {
  return dados.grupos.filter(g => g.empresa).map(grupo => empresaNoMes(grupo, mes));
}

function registrarDevolucao(campos) {
  dados.devolucoes.push({ ...campos, id: novoId() });
  salvar();
}

function apagarDevolucao(id) {
  dados.devolucoes = dados.devolucoes.filter(d => d.id !== id);
  salvar();
}

// "Não vai voltar": o gasto continua contando como saída, mas sai do que a empresa vai devolver
function marcarNaoVolta(tipo, id, naoVolta) {
  const item = (tipo === 'conta' ? dados.contas : dados.compras).find(i => i.id === id);
  if (item) item.naoVolta = naoVolta;
  salvar();
}

// Primeiro mês com alguma coisa cadastrada (o histórico começa aí, pra não contar meses antes do app como "zero")
function primeiroMes() {
  const meses = [...dados.ganhos, ...dados.contas, ...dados.faturas].map(x => x.mes).sort();
  return meses[0] || null;
}

// Mês a mês, quanto cada empresa gastou do dinheiro de vocês (a meta é chegar a zero)
function historicoEmpresas(mesFinal, limite = 12) {
  const inicio = primeiroMes();
  if (!inicio) return [];
  const meses = [];
  for (let mes = mesFinal; mes >= inicio && meses.length < limite; mes = somarMeses(mes, -1)) meses.push(mes);
  return meses.map(mes => ({ mes, empresas: empresasDoMes(mes) }));
}

// "Parcela 2/6" e "Parcela 3/6" da mesma compra têm o mesmo nome sem a parte da parcela
function semParcela(texto) {
  return normalizar(texto).replace(/(parcela|parc\.?)?\s*\d{1,2}\s*(\/|de)\s*\d{1,2}\s*$/, '').trim();
}

// Já comprometido no cartão pro mês que vem = compras que já estão nas faturas do mês que vem
// + as próximas parcelas das compras parceladas deste mês (quando ainda não estão lá)
function comprometidoProximoMes(mes) {
  const proximo = somarMeses(mes, 1);
  let total = 0;
  for (const cartao of dados.cartoes) {
    const faturaProxima = faturaDe(cartao.id, proximo);
    const comprasProximas = faturaProxima ? comprasDa(faturaProxima.id) : [];
    total += soma(comprasProximas);

    const faturaAtual = faturaDe(cartao.id, mes);
    if (!faturaAtual) continue;
    for (const compra of comprasDa(faturaAtual.id)) {
      const p = compra.parcela;
      if (!p || p.atual >= p.total) continue;
      const jaEsta = comprasProximas.some(c => c.parcela && c.parcela.total === p.total && c.parcela.atual === p.atual + 1 &&
        semParcela(c.descricaoBanco || c.descricao) === semParcela(compra.descricaoBanco || compra.descricao));
      if (!jaEsta) total += compra.valor;
    }
  }
  return total;
}

// Contas do mês que, pelo jeito, são faturas cadastradas como conta comum na Fase 1
// (categoria "Cartão" ou com o mesmo nome de um cartão). Sugere o cartão quando o nome bate.
function contasQueParecemFatura(mes) {
  if (!dados.cartoes.length) return [];
  return dados.contas.filter(c => c.mes === mes).map(conta => {
    const cartao = dados.cartoes.find(k => normalizar(k.nome) === normalizar(conta.nome));
    const categoriaCartao = normalizar(nomeCategoria(conta.categoriaId)) === 'cartao';
    return cartao || categoriaCartao ? { conta, cartaoId: cartao ? cartao.id : '' } : null;
  }).filter(Boolean);
}

// A conta vira a fatura do cartão naquele mês e deixa de existir, pra não contar duas vezes.
// Se ela repetia todo mês, para de repetir dali pra frente: as faturas agora vêm do cartão.
function transformarEmFatura(contaId, cartaoId) {
  const conta = dados.contas.find(c => c.id === contaId);
  if (!conta) return null;
  const fatura = garantirFatura(cartaoId, conta.mes);
  if (fatura.valorBanco == null) fatura.valorBanco = conta.valor;
  if (conta.pagaEm && !fatura.pagaEm) fatura.pagaEm = conta.pagaEm;
  registrarHistorico(fatura, 'Conta transformada em fatura', 0);
  apagar('conta', contaId, Boolean(conta.serieId)); // também salva
  return fatura;
}

// ---------- Descrições padrão (o app aprende como vocês chamam cada compra) ----------

// Pra comparar textos do banco: sem acento, maiúscula, pontuação e espaços extras ("UBER *TRIP" = "uber trip")
function chaveTexto(texto) {
  return normalizar(texto).replace(/[^a-z0-9]+/g, ' ').trim();
}

// "LOJA DECORAÇÃO - PARCELA 2/6" → "LOJA DECORAÇÃO" (a parcela muda todo mês; o padrão não)
function tirarParcela(texto) {
  return String(texto || '').replace(/[\s-]*(?:parcela|parc\.?)?\s*\d{1,2}\s*(?:\/|de)\s*\d{1,2}\s*$/i, '').trim();
}

// O padrão que vale pra esse texto do banco: entre os que ele "contém", o mais específico (texto mais longo)
function regraPara(textoBanco) {
  const chave = chaveTexto(textoBanco);
  if (!chave) return null;
  return dados.regras
    .filter(r => chaveTexto(r.texto) && ` ${chave} `.includes(` ${chaveTexto(r.texto)} `))
    .sort((a, b) => chaveTexto(b.texto).length - chaveTexto(a.texto).length)[0] || null;
}

// Aplica o padrão numa compra que acabou de chegar da importação
function aplicarRegra(item) {
  const regra = regraPara(item.descricaoBanco);
  if (!regra) return;
  if (regra.descricao) item.descricao = regra.descricao;
  if (regra.categoriaId && dados.categorias.some(c => c.id === regra.categoriaId)) item.categoriaId = regra.categoriaId;
  if (regra.grupoId && grupoDe(regra.grupoId)) item.grupoId = regra.grupoId;
  item.regra = regra.id;
}

// O que um padrão faria com essa compra (pra saber se já está tudo igual e não precisa aprender nada)
function mesmoResultado(regra, descricao, categoriaId, grupoId) {
  return regra.descricao === descricao && regra.categoriaId === categoriaId && regra.grupoId === grupoId;
}

// Guarda (ou atualiza) o padrão a partir do que vocês escolheram numa compra.
// Só aprende se teve escolha de verdade: descrição diferente do banco, categoria, ou coluna diferente de "Nosso".
function aprender(textoBanco, descricao, categoriaId, grupoId) {
  const texto = tirarParcela(textoBanco);
  if (!chaveTexto(texto)) return false;
  const desc = [chaveTexto(texto), chaveTexto(textoBanco)].includes(chaveTexto(descricao)) ? '' : String(descricao || '').trim();
  const cat = categoriaId || '';
  const grp = grupoId && dados.grupos[0] && grupoId !== dados.grupos[0].id ? grupoId : '';
  if (!desc && !cat && !grp) return false;

  const valendo = regraPara(textoBanco);
  if (valendo && mesmoResultado(valendo, desc, cat, grp)) return false; // um padrão já faz exatamente isso
  const igual = dados.regras.find(r => chaveTexto(r.texto) === chaveTexto(texto));
  if (igual) Object.assign(igual, { descricao: desc, categoriaId: cat, grupoId: grp });
  else dados.regras.push({ id: novoId(), texto, descricao: desc, categoriaId: cat, grupoId: grp, origem: 'aprendida', em: hojeISO() });
  return true;
}

function aprenderDaCompra(compra) {
  return compra.descricaoBanco ? aprender(compra.descricaoBanco, compra.descricao, compra.categoriaId, grupoDaCompra(compra).id) : false;
}

function salvarRegra(id, campos) {
  let regra = dados.regras.find(r => r.id === id);
  if (regra) Object.assign(regra, campos);
  else dados.regras.push(regra = { ...campos, id: novoId(), origem: 'cadastrada', em: hojeISO() });
  const aplicadas = aplicarRegraNasCompras(regra);
  salvar();
  return aplicadas;
}

function apagarRegra(id) {
  dados.regras = dados.regras.filter(r => r.id !== id);
  salvar();
}

// Um padrão novo também vale pras compras já salvas que ainda estão com o texto do banco
// (as que vocês já renomearam ficam como estão). Categoria só entra onde ainda não tinha.
function aplicarRegraNasCompras(regra) {
  let quantas = 0;
  for (const compra of dados.compras) {
    if (!compra.descricaoBanco || regraPara(compra.descricaoBanco) !== regra) continue;
    const intocada = !compra.descricao || chaveTexto(compra.descricao) === chaveTexto(compra.descricaoBanco);
    let mudou = false;
    if (regra.descricao && intocada) { compra.descricao = regra.descricao; mudou = true; }
    if (regra.categoriaId && !compra.categoriaId) { compra.categoriaId = regra.categoriaId; mudou = true; }
    if (mudou) quantas++;
  }
  return quantas;
}

// ---------- Histórico e atualização da fatura ----------

// Cada importação deixa um registro: quando, de onde, quantas compras e quanto ficou
function registrarHistorico(fatura, origem, novas) {
  fatura.historico = fatura.historico || [];
  fatura.historico.push({
    em: new Date().toISOString(),
    origem,
    qtd: comprasDa(fatura.id).length,
    detalhado: detalhadoDa(fatura),
    valorBanco: fatura.valorBanco,
    novas,
  });
}

// A mesma compra, em duas importações: mesmo texto do banco, mesma data, mesmo valor
function chaveDaCompra(compra) {
  return `${normalizar(compra.descricaoBanco || compra.descricao)}|${compra.data}|${compra.valor}`;
}

// Ao atualizar uma fatura que já tem compras: as compras iguais trazem o que vocês já tinham editado
// (descrição, categoria, pra quem é, parcela); as que não estavam lá ganham a etiqueta "Nova"
function aproveitarEdicoes(itens, faturaId) {
  const antigas = new Map();
  for (const compra of comprasDa(faturaId)) {
    const chave = chaveDaCompra(compra);
    antigas.set(chave, [...(antigas.get(chave) || []), compra]);
  }
  for (const item of itens) {
    const iguais = antigas.get(chaveDoItem(item));
    const antiga = iguais && iguais.shift();
    item.nova = !antiga;
    if (antiga) Object.assign(item, { descricao: antiga.descricao || item.descricao, categoriaId: antiga.categoriaId, grupoId: antiga.grupoId, parcela: antiga.parcela || item.parcela });
  }
}

// Guarda o que foi revisado na importação. "substituir" troca as compras que já estavam na fatura (atualizar).
function salvarImportacao({ cartaoId, mes, valorBanco, itens, substituir, origem }) {
  const fatura = garantirFatura(cartaoId, mes);
  if (substituir) dados.compras = dados.compras.filter(c => c.faturaId !== fatura.id);
  if (valorBanco != null) fatura.valorBanco = valorBanco;
  const mantidos = itens.filter(i => i.manter);
  for (const item of mantidos) {
    dados.compras.push({
      id: novoId(),
      faturaId: fatura.id,
      data: item.data,
      descricaoBanco: item.descricaoBanco,
      descricao: item.descricao.trim() || item.descricaoBanco,
      valor: item.valor,
      categoriaId: item.categoriaId,
      grupoId: item.grupoId,
      parcela: item.parcela,
    });
  }
  registrarHistorico(fatura, `${substituir ? 'Atualizada' : 'Importada'}${origem ? ` · ${origem}` : ''}`, mantidos.filter(i => i.nova).length);
  salvar();
  return fatura;
}
