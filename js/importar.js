// Nosso Mês — lê a fatura (CSV do Nubank, PDF do Mercado Pago e do Banco do Brasil, ou prints da tela) e monta a lista de compras.
// Tudo acontece aqui no navegador: os arquivos e as imagens não são enviados pra lugar nenhum.

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function ehImagem(arquivo) {
  return arquivo.type.startsWith('image/') || /\.(png|jpe?g|webp|heic)$/i.test(arquivo.name);
}

// Lê um arquivo e devolve { itens, total } (total = valor da fatura, quando o arquivo mostra)
async function lerArquivoDeFatura(arquivo, mesFatura) {
  const nome = arquivo.name.toLowerCase();
  if (ehImagem(arquivo)) return lerLinhasDeTexto(await linhasDaImagem(arquivo), mesFatura, { soltas: true });
  if (nome.endsWith('.pdf') || arquivo.type === 'application/pdf') {
    const linhas = await linhasDoPDF(arquivo);
    return lerLinhasDeTexto(linhas, mesFatura);
  }
  const texto = await arquivo.text();
  const doCSV = lerCSV(texto, mesFatura);
  return doCSV.itens.length ? doCSV : lerLinhasDeTexto(texto.split(/\r?\n/), mesFatura);
}

// Vários arquivos de uma vez (ex.: 3 prints rolando a fatura). Compra que aparece repetida
// em dois prints seguidos (a parte que se sobrepõe ao rolar a tela) entra uma vez só.
async function lerArquivosDeFatura(arquivos, mesFatura, aoAvancar) {
  const itens = [];
  let total = null, anteriores = [];
  for (let i = 0; i < arquivos.length; i++) {
    if (aoAvancar) aoAvancar(i + 1, arquivos.length);
    const lido = await lerArquivoDeFatura(arquivos[i], mesFatura);
    const sobra = [...anteriores];
    for (const item of lido.itens) {
      const repetido = sobra.findIndex(a => chaveDoItem(a) === chaveDoItem(item));
      if (repetido >= 0 && ehImagem(arquivos[i])) sobra.splice(repetido, 1);
      else itens.push(item);
    }
    anteriores = lido.itens;
    if (total == null) total = lido.total;
  }
  return { itens, total };
}

function chaveDoItem(item) {
  return `${normalizar(item.descricaoBanco)}|${item.data}|${item.valor}`;
}

// ---------- Pedaços que os dois formatos usam ----------

// "2026-10-05", "05/10/2026", "05/10/26", "05/10" ou "05 OUT" → "2026-10-05".
// Sem ano, usa o ano da fatura (e o anterior, se o mês da compra vem depois do mês da fatura: compra de dezembro na fatura de janeiro).
function lerData(texto, mesFatura) {
  const t = String(texto).trim().toLowerCase();
  let ano, mes, dia;
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) [, ano, mes, dia] = m.map(Number);
  else if ((m = t.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/))) {
    [dia, mes] = [Number(m[1]), Number(m[2])];
    if (m[3]) ano = Number(m[3].length === 2 ? '20' + m[3] : m[3]);
  } else if ((m = t.match(/^(\d{1,2})\s*(?:de\s*)?([a-zç]{3})/))) {
    dia = Number(m[1]);
    mes = MESES_CURTOS.indexOf(m[2].replace('ç', 'c').slice(0, 3)) + 1;
    if (!mes) return null;
  } else return null;

  if (!(mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31)) return null;
  if (!ano) {
    const [anoFatura, mesDaFatura] = mesFatura.split('-').map(Number);
    ano = mes > mesDaFatura ? anoFatura - 1 : anoFatura;
  }
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// Valor em centavos, com sinal: "1.234,56" · "-42,30" · "R$ 12,00-" · "1234.56" (formato do CSV do Nubank)
function lerValorComSinal(texto) {
  const t = String(texto).trim();
  const negativo = /^[-−(]|-\s*$|\)\s*$|\bC$/.test(t) || /^-\s*R\$/.test(t);
  let limpo = t.replace(/[^\d.,]/g, '');
  if (!limpo) return NaN;
  if (limpo.includes(',')) limpo = limpo.replace(/\./g, '').replace(',', '.');
  const numero = Number(limpo);
  if (!Number.isFinite(numero)) return NaN;
  return Math.round(numero * 100) * (negativo ? -1 : 1);
}

// "Parcela 5/6", "Parc 5/6", "5 de 6" ou "05/06" no fim da descrição → { atual: 5, total: 6 }
function lerParcela(descricao) {
  const t = normalizar(descricao);
  const m = t.match(/(?:parcela|parc\.?)\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/) || t.match(/\s(\d{1,2})\s*\/\s*(\d{1,2})$/) || t.match(/\s(\d{1,2})\s+de\s+(\d{1,2})$/);
  if (!m) return null;
  const atual = Number(m[1]), total = Number(m[2]);
  return atual >= 1 && total >= 2 && atual <= total && total <= 48 ? { atual, total } : null;
}

// Pagamento da fatura anterior e estorno vêm negativos: ficam marcados pra pessoa decidir.
// Pagamento começa desmarcado (não é compra); estorno começa marcado (diminui a fatura).
function novoItem({ data, descricaoBanco, valor }) {
  const tipo = valor >= 0 ? 'compra' : /pagamento|pagto|pgto/.test(normalizar(descricaoBanco)) ? 'pagamento' : 'estorno';
  const texto = descricaoBanco.replace(/\s+/g, ' ').trim();
  return {
    data,
    descricaoBanco: texto, // o texto original do banco fica guardado (pra reconhecer a mesma compra depois)
    descricao: texto, // é este que vocês editam
    nova: false,
    valor,
    categoriaId: '',
    grupoId: dados.grupos[0] ? dados.grupos[0].id : '',
    parcela: lerParcela(descricaoBanco),
    tipo,
    manter: tipo !== 'pagamento',
  };
}

// ---------- CSV (Nubank: "date,title,amount") ----------

function separarCSV(linha, separador) {
  const campos = [];
  let atual = '', aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas;
    } else if (c === separador && !aspas) { campos.push(atual); atual = ''; }
    else atual += c;
  }
  campos.push(atual);
  return campos.map(c => c.trim());
}

function lerCSV(texto, mesFatura) {
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (!linhas.length) return { itens: [], total: null };
  const separador = (linhas[0].match(/;/g) || []).length > (linhas[0].match(/,/g) || []).length ? ';' : ',';
  const tabela = linhas.map(l => separarCSV(l, separador));

  // Acha as colunas pelo cabeçalho; sem cabeçalho, pelo jeito dos valores
  const cabecalho = tabela[0].map(normalizar);
  const achar = (...nomes) => cabecalho.findIndex(c => nomes.some(n => c.includes(n)));
  let colData = achar('date', 'data');
  let colDescricao = achar('title', 'descri', 'estabelecimento', 'historico', 'lancamento');
  let colValor = achar('amount', 'valor');
  let corpo = tabela.slice(1);

  if (colData < 0 || colDescricao < 0 || colValor < 0) {
    const exemplo = tabela[0];
    colData = exemplo.findIndex(c => lerData(c, mesFatura));
    colValor = exemplo.length - 1 - [...exemplo].reverse().findIndex(c => /\d[.,]\d{2}\s*$/.test(c));
    colDescricao = exemplo.findIndex((c, i) => i !== colData && i !== colValor && /[a-z]/i.test(c));
    corpo = tabela;
    if (colData < 0 || colDescricao < 0 || colValor >= exemplo.length) return { itens: [], total: null };
  }

  const itens = [];
  for (const linha of corpo) {
    const data = lerData(linha[colData] || '', mesFatura);
    const valor = lerValorComSinal(linha[colValor] || '');
    const descricaoBanco = linha[colDescricao] || '';
    if (data && Number.isFinite(valor) && valor !== 0 && descricaoBanco) itens.push(novoItem({ data, descricaoBanco, valor }));
  }
  return { itens, total: null };
}

// ---------- PDF e texto solto (Mercado Pago, Banco do Brasil) ----------

let carregandoPdfjs = null;
function carregarPdfjs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  carregandoPdfjs = carregandoPdfjs || new Promise((resolver, rejeitar) => {
    const script = document.createElement('script');
    script.src = 'lib/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
      resolver(window.pdfjsLib);
    };
    script.onerror = () => rejeitar(new Error('Não consegui carregar o leitor de PDF'));
    document.head.appendChild(script);
  });
  return carregandoPdfjs;
}

// Junta os pedacinhos de texto do PDF em linhas, pela altura em que aparecem na página
async function linhasDoPDF(arquivo) {
  const pdfjs = await carregarPdfjs();
  const pdf = await pdfjs.getDocument({ data: await arquivo.arrayBuffer() }).promise;
  const linhas = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const pagina = await pdf.getPage(n);
    const { items } = await pagina.getTextContent();
    const porAltura = [];
    for (const item of items) {
      if (!item.str.trim()) continue;
      const [x, y] = [item.transform[4], item.transform[5]];
      let linha = porAltura.find(l => Math.abs(l.y - y) < 3);
      if (!linha) porAltura.push(linha = { y, pedacos: [] });
      linha.pedacos.push({ x, texto: item.str });
    }
    porAltura.sort((a, b) => b.y - a.y);
    for (const linha of porAltura) linhas.push(linha.pedacos.sort((a, b) => a.x - b.x).map(p => p.texto).join(' '));
  }
  return linhas;
}

// Procura linhas no formato "data  descrição  valor"; e a linha do total da fatura.
// { soltas: true } é pros prints dos aplicativos: a data costuma vir sozinha numa linha ("25 SET")
// e vale pras compras de baixo; e a parcela às vezes vem na linha de baixo da compra ("Parcela 2/6").
function lerLinhasDeTexto(linhas, mesFatura, { soltas = false } = {}) {
  const meses = MESES_CURTOS.join('|');
  const inicioData = new RegExp(`^\\s*(\\d{1,2}[/.-]\\d{1,2}(?:[/.-]\\d{2,4})?|\\d{1,2}\\s*(?:de\\s*)?(?:${meses})[a-zç]*\\.?)\\s+`, 'i');
  const soData = new RegExp(`^(?:(?:seg|ter|qua|qui|sex|s[aá]b|dom)[a-zç-]*\\.?,?\\s*)?(\\d{1,2}[/.-]\\d{1,2}(?:[/.-]\\d{2,4})?|\\d{1,2}\\s*(?:de\\s*)?(?:${meses})[a-zç]*\\.?)(?:\\s*(?:de\\s*)?\\d{4})?$`, 'i');
  const fimValor = /\s(-\s*|−\s*)?((?:R\$|RS|R5)\s*)?(-\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})(\s*-|\s*[DC])?\s*$/;
  const linhaTotal = /(total\s+(da|desta)\s+fatura|total\s+a\s+pagar|valor\s+total|total\s+da\s+sua\s+fatura|valor\s+da\s+fatura|fatura\s+(atual|aberta)|valor\s+atual)/i;
  const naoECompra = /limite|dispon[ií]vel|pagamento\s+m[ií]nimo|vencimento|fecha(mento)?\b|saldo|melhor\s+dia|^total|parcelamento\s+de\s+fatura/i;
  const soParcela = /^(?:parcela|parc\.?)\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})$/i;

  const hoje = hojeISO();
  const dataPadrao = hoje.startsWith(mesFatura) || hoje.slice(0, 7) === somarMeses(mesFatura, -1) ? hoje : `${mesFatura}-01`;
  const soValor = /^(-\s*)?((?:R\$|RS|R5)\s*)?\d{1,3}(?:\.\d{3})*,\d{2}$/;
  const itens = [];
  let total = null, dataAtual = null, totalNaProxima = false;

  for (const bruta of linhas) {
    const linha = bruta.replace(/\s+/g, ' ').trim();
    if (!linha) continue;

    // "Fatura atual" numa linha e "R$ 1.538,60" sozinho na de baixo (comum nos aplicativos)
    if (totalNaProxima && soValor.test(linha)) {
      if (total == null) total = lerValorComSinal(linha);
      totalNaProxima = false;
      continue;
    }
    totalNaProxima = linhaTotal.test(linha) && !/\d,\d{2}\s*$/.test(linha);

    if (soltas) {
      const soDataAchada = linha.match(soData);
      if (soDataAchada) { dataAtual = lerData(soDataAchada[1], mesFatura) || dataAtual; continue; }
      if (/^hoje$/i.test(linha)) { dataAtual = hoje; continue; }
      if (/^ontem$/i.test(linha)) { dataAtual = somarDias(hoje, -1); continue; }
      const parcela = linha.match(soParcela);
      if (parcela && itens.length && !itens[itens.length - 1].parcela) {
        itens[itens.length - 1].parcela = lerParcela(`parcela ${parcela[1]}/${parcela[2]}`);
        continue;
      }
    }

    const valorNoFim = linha.match(fimValor);
    if (!valorNoFim) continue;
    const valor = lerValorComSinal(valorNoFim[0]);

    if (linhaTotal.test(linha) && total == null && valor > 0) { total = valor; continue; }

    const dataNoInicio = linha.match(inicioData);
    if (!dataNoInicio && !soltas) continue;
    if (soltas && naoECompra.test(linha)) continue;
    const data = dataNoInicio ? lerData(dataNoInicio[1], mesFatura) : (dataAtual || dataPadrao);
    const descricaoBanco = linha.slice(dataNoInicio ? dataNoInicio[0].length : 0, linha.length - valorNoFim[0].length).replace(/[•·|]+$/, '').trim();
    if (!data || !/[a-zà-ú]{2}/i.test(descricaoBanco) || !Number.isFinite(valor) || valor === 0) continue;
    itens.push(novoItem({ data, descricaoBanco, valor }));
  }
  return { itens, total };
}

function somarDias(iso, dias) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia + dias);
  return `${mesDe(data)}-${String(data.getDate()).padStart(2, '0')}`;
}

// ---------- Prints (imagens): leitura de texto com o Tesseract, aqui no navegador ----------

let leitorDeImagem = null;
function carregarLeitorDeImagem() {
  leitorDeImagem = leitorDeImagem || new Promise((resolver, rejeitar) => {
    const script = document.createElement('script');
    script.src = 'lib/tesseract/tesseract.min.js';
    script.onload = async () => {
      try {
        const pasta = new URL('lib/tesseract/', location.href).href; // endereço completo: o leitor roda num "worker" em outra pasta
        const worker = await window.Tesseract.createWorker('por', 1, {
          workerPath: pasta + 'worker.min.js',
          corePath: pasta,
          langPath: pasta + 'lang',
          workerBlobURL: false,
          gzip: true,
        });
        resolver(worker);
      } catch (erro) { rejeitar(erro); }
    };
    script.onerror = () => rejeitar(new Error('Não consegui carregar o leitor de imagem'));
    document.head.appendChild(script);
  });
  return leitorDeImagem;
}

// Prepara o print pra leitura: cinza, maior (se for pequeno) e com fundo claro (inverte prints do modo escuro)
async function prepararImagem(arquivo) {
  const bitmap = await createImageBitmap(arquivo);
  const escala = bitmap.width < 1200 ? 2 : 1;
  const tela = document.createElement('canvas');
  tela.width = bitmap.width * escala;
  tela.height = bitmap.height * escala;
  const ctx = tela.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, tela.width, tela.height);
  const imagem = ctx.getImageData(0, 0, tela.width, tela.height);
  const px = imagem.data;
  let soma = 0;
  for (let i = 0; i < px.length; i += 4) soma += px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
  const escuro = soma / (px.length / 4) < 128;
  for (let i = 0; i < px.length; i += 4) {
    let cinza = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
    if (escuro) cinza = 255 - cinza;
    px[i] = px[i + 1] = px[i + 2] = cinza;
  }
  ctx.putImageData(imagem, 0, 0);
  return tela;
}

async function linhasDaImagem(arquivo) {
  const leitor = await carregarLeitorDeImagem();
  const { data } = await leitor.recognize(await prepararImagem(arquivo));
  return data.text.split(/\r?\n/);
}
