// Nosso Mês — telas dos cartões: a lista de cartões, a fatura detalhada e a importação (com a revisão das compras).

// "2026-10" → "outubro de 2026" (pro meio de frase)
function mesComAno(mes) {
  return `${nomeDoMes(mes, false)} de ${mes.slice(0, 4)}`;
}

function nomeTitular(chave) {
  return chave === 'p2' ? dados.casal.pessoa2 : dados.casal.pessoa1;
}

function pessoasDoCasal() {
  return [{ id: 'p1', nome: dados.casal.pessoa1 }, { id: 'p2', nome: dados.casal.pessoa2 }];
}

function seloFatura(fatura) {
  return fatura.pagaEm
    ? `<button class="selo feito" data-acao="desfazer-pagamento-fatura" data-id="${fatura.id}" title="Toque pra desfazer">Pago ${dataCurta(fatura.pagaEm)}</button>`
    : `<button class="selo" data-acao="pagar-fatura" data-id="${fatura.id}">Paguei</button>`;
}

// Compara o valor do banco com a soma das compras e explica a diferença
function avisoDiferenca(fatura) {
  const qtd = comprasDa(fatura.id).length;
  const detalhado = detalhadoDa(fatura);
  if (fatura.valorBanco == null) {
    return qtd ? '<p class="ajuda">Sem o valor cobrado pelo banco: a folga usa a soma das compras.</p>' : '<p class="ajuda">Ainda sem compras nem valor do banco.</p>';
  }
  if (!qtd) return '<p class="ajuda">Ainda sem compras detalhadas.</p>';
  const diferenca = fatura.valorBanco - detalhado;
  if (diferenca === 0) return '<p class="fatura-ok">✓ O detalhado bate com o valor do banco</p>';
  const texto = diferenca > 0
    ? `Detalhado ${real(detalhado)} de ${real(fatura.valorBanco)}: faltam ${real(diferenca)} sem explicação`
    : `Detalhado ${real(detalhado)} passa ${real(-diferenca)} do valor do banco (${real(fatura.valorBanco)})`;
  return `<p class="fatura-aviso">${icone('aviso')}<span>${texto}</span></p>`;
}

function totaisDasColunas(colunas) {
  return `
    <div class="resumo" style="grid-template-columns: repeat(${colunas.length}, minmax(0, 1fr))">
      ${colunas.map(c => `<div><small>${esc(c.grupo.nome)}</small><strong>${real(c.total)}</strong></div>`).join('')}
    </div>`;
}

// ---------- Linhas de preenchimento: cartão e compra ----------

function acoesSimples(item, tipo, textoAdicionar) {
  if (!item) return `<div class="linha-acoes"><button class="botao pequeno">${textoAdicionar}</button></div>`;
  return `
    <div class="linha-acoes editar">
      <button type="button" class="botao perigo-texto" data-acao="apagar-${tipo}" data-id="${item.id}">Apagar</button>
      <button type="button" class="botao pequeno secundario" data-acao="cancelar-edicao">Cancelar</button>
      <button class="botao pequeno">Salvar</button>
    </div>`;
}

function linhaCartao(cartao) {
  const c = cartao || { nome: '', banco: '', titular: 'p1', fechamento: '', vencimento: '' };
  return `
    <form class="linha-form linha-cartao" data-form="cartao" data-id="${cartao ? cartao.id : ''}">
      <div class="linha-campos">
        <label class="campo campo-nome"><span>Nome do cartão</span><input name="nome" required value="${esc(c.nome)}" placeholder="Ex.: Nubank Lucas" autocomplete="off"></label>
        <label class="campo"><span>Banco</span><input name="banco" value="${esc(c.banco)}" placeholder="Ex.: Nubank" autocomplete="off"></label>
        <label class="campo"><span>Titular</span><select name="titular">${opcoes(pessoasDoCasal(), c.titular)}</select></label>
        <label class="campo"><span>Fecha dia</span><input name="fechamento" required type="number" min="1" max="31" inputmode="numeric" value="${c.fechamento}" placeholder="3"></label>
        <label class="campo"><span>Vence dia</span><input name="vencimento" required type="number" min="1" max="31" inputmode="numeric" value="${c.vencimento}" placeholder="10"></label>
        ${acoesSimples(cartao, 'cartao', 'Adicionar')}
      </div>
    </form>`;
}

function campoParcela(parcela) {
  return `
    <div class="campo campo-parcela"><span>Parcela</span>
      <div class="parcela-par">
        <input name="parcelaAtual" inputmode="numeric" value="${parcela ? parcela.atual : ''}" placeholder="–" aria-label="Parcela atual">
        <span>de</span>
        <input name="parcelaTotal" inputmode="numeric" value="${parcela ? parcela.total : ''}" placeholder="–" aria-label="Total de parcelas">
      </div>
    </div>`;
}

function linhaCompra(compra, fatura) {
  const c = compra || { data: '', descricaoBanco: '', descricao: '', valor: null, categoriaId: '', grupoId: dados.grupos[0] && dados.grupos[0].id, parcela: null };
  const dataPadrao = c.data || (fatura && fatura.mes === mesAtual() ? hojeISO() : `${(fatura || {}).mes || mesAtual()}-01`);
  return `
    <form class="linha-form linha-compra" data-form="compra" data-id="${compra ? compra.id : ''}" data-fatura="${fatura ? fatura.id : ''}">
      <div class="linha-campos">
        <label class="campo campo-nome"><span>Descrição</span><input name="descricao" required value="${esc(c.descricao || c.descricaoBanco)}" placeholder="Ex.: Presente da mãe" autocomplete="off"></label>
        <label class="campo"><span>Data</span><input name="data" type="date" required value="${dataPadrao}"></label>
        <label class="campo"><span>Valor</span><input name="valor" required inputmode="decimal" value="${c.valor != null ? valorParaCampo(c.valor) : ''}" placeholder="0,00" autocomplete="off"></label>
        <label class="campo"><span>Categoria</span><select name="categoriaId">${opcoes(dados.categorias, c.categoriaId, 'Sem categoria')}</select></label>
        <label class="campo"><span>Pra quem é</span><select name="grupoId">${opcoes(dados.grupos, c.grupoId)}</select></label>
        ${campoParcela(c.parcela)}
        ${acoesSimples(compra, 'compra', 'Adicionar')}
      </div>
    </form>`;
}

// ---------- Tela Cartões ----------

function painelCartao(cartao) {
  if (cartao.id === editando) return `<section class="secao cartao-painel">${linhaCartao(cartao)}</section>`;
  const fatura = faturaDe(cartao.id, mesVisivel);
  const mes = nomeDoMes(mesVisivel, false);
  const detalhes = [cartao.banco, nomeTitular(cartao.titular), `fecha dia ${cartao.fechamento}`, `vence dia ${cartao.vencimento}`].filter(Boolean).join(' · ');

  let corpo;
  if (fatura) {
    const qtd = comprasDa(fatura.id).length;
    corpo = `
      <div class="fatura-resumo ${estaVencida(faturaComoConta(fatura)) ? 'vencida' : ''}">
        <div>
          <small>Fatura de ${mes} · vence dia ${cartao.vencimento}</small>
          <strong class="fatura-valor">${real(valorDaFatura(fatura))}</strong>
        </div>
        ${seloFatura(fatura)}
      </div>
      ${avisoDiferenca(fatura)}
      ${qtd ? totaisDasColunas(colunasDaFatura(fatura.id)) : ''}
      ${fatura.historico && fatura.historico.length ? `<p class="ajuda">Última atualização: ${quando(fatura.historico[fatura.historico.length - 1].em)}</p>` : ''}
      <div class="cartao-acoes">
        <a class="botao pequeno" href="#fatura/${fatura.id}">${qtd ? `Ver as ${qtd} compras` : 'Abrir a fatura'}</a>
        <a class="botao pequeno secundario" href="#importar/${cartao.id}/${mesVisivel}">${qtd ? 'Atualizar' : 'Importar'}</a>
      </div>`;
  } else {
    corpo = `
      <p class="tudo-certo">Nenhuma fatura de ${mes} ainda.</p>
      <div class="cartao-acoes">
        <a class="botao pequeno" href="#importar/${cartao.id}/${mesVisivel}">Importar fatura</a>
        <button class="botao pequeno secundario" data-acao="criar-fatura" data-id="${cartao.id}">Criar à mão</button>
      </div>`;
  }

  return `
    <section class="secao cartao-painel">
      <div class="cartao-topo">
        <span class="cartao-marca" aria-hidden="true">${icone('cartao')}</span>
        <div class="cartao-nome">
          <h2>${esc(cartao.nome)}</h2>
          <p class="detalhe">${esc(detalhes)}</p>
        </div>
        <button class="botao-texto" data-acao="editar-cartao" data-id="${cartao.id}">Editar</button>
      </div>
      ${corpo}
    </section>`;
}

// Contas da Fase 1 que eram faturas: oferece transformar em fatura do cartão
function blocoTransformar() {
  const candidatas = contasQueParecemFatura(mesVisivel);
  if (!candidatas.length) return '';
  return `
    <section class="secao primeira transformar">
      <h2>Faturas cadastradas como conta</h2>
      <p class="ajuda">Antes dos cartões, a fatura entrava como conta comum. Transformem em fatura do cartão pra ver as compras, sem contar duas vezes.</p>
      <ul class="lista">
        ${candidatas.map(({ conta, cartaoId }) => `
          <li>
            <form class="linha-transformar" data-form="transformar" data-id="${conta.id}">
              <div class="item-principal">
                <span class="nome">${esc(conta.nome)}</span>
                <span class="detalhe">${real(conta.valor)} · dia ${conta.dia}${conta.serieId ? ' · ↻ todo mês (para de repetir)' : ''}</span>
              </div>
              <select name="cartaoId" required aria-label="Cartão de ${esc(conta.nome)}">${opcoes(dados.cartoes, cartaoId, 'Escolham o cartão')}</select>
              <button class="botao pequeno">Transformar</button>
            </form>
          </li>`).join('')}
      </ul>
    </section>`;
}

function telaCartoes() {
  const nova = novaLinha('Novo cartão', linhaCartao());
  if (!dados.cartoes.length) {
    return `
      <div class="vazio">
        <div class="icone">${icone('cartao')}</div>
        <strong>Cadastrem os cartões de vocês</strong>
        <p>Com o dia de fechamento e de vencimento de cada um. Depois é só importar as faturas.</p>
      </div>
      ${nova}`;
  }
  const qtdRegras = dados.regras.length;
  const atalho = `
    <a class="atalho" href="#descricoes">
      <span><strong>Descrições padrão</strong><small>${qtdRegras ? `${qtdRegras} ${qtdRegras === 1 ? 'guardada' : 'guardadas'}` : 'Pras compras já chegarem com o nome que vocês usam'}</small></span>
      ${icone('seguinte')}
    </a>`;
  return blocoTransformar() + `<div class="grade-cartoes">${dados.cartoes.map(painelCartao).join('')}</div>` + atalho + nova;
}

// ---------- Tela da fatura ----------

function itemCompra(compra) {
  if (compra.id === editando) return `<li class="editando">${linhaCompra(compra, dados.faturas.find(f => f.id === compra.faturaId))}</li>`;
  const nome = compra.descricao || compra.descricaoBanco || 'Compra';
  const detalhes = [dataCurta(compra.data), compra.categoriaId ? nomeCategoria(compra.categoriaId) : null].filter(Boolean).join(' · ');
  const parcela = compra.parcela ? `<span class="parcela" title="Parcela ${compra.parcela.atual} de ${compra.parcela.total}">${compra.parcela.atual}/${compra.parcela.total}</span>` : '';

  // Dá pra arrastar pra outra coluna (computador) ou usar o botão de mover (celular e teclado)
  return `
    <li class="${compra.parcela ? 'parcelada' : ''}" draggable="true" data-arrastar="${compra.id}">
      <button class="item-principal" data-acao="editar-compra" data-id="${compra.id}">
        <span class="nome">${esc(nome)}</span>
        <span class="detalhe">${esc(detalhes)}</span>
      </button>
      <div class="item-lado">
        <span class="quanto">${real(compra.valor)}</span>
        <span class="item-lado-baixo">
          ${parcela}
          <button class="mover" data-acao="mover-compra" data-id="${compra.id}" aria-label="Mover “${esc(nome)}” pra outra coluna" title="Mover pra outra coluna">${icone('mover')}</button>
        </span>
      </div>
    </li>`;
}

// "Última atualização" e a lista de todas, com o que mudou de uma pra outra
function quando(iso) {
  const data = new Date(iso);
  return `${data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function diferenca(atual, anterior) {
  if (!anterior) return '';
  const qtd = atual.qtd - anterior.qtd, valor = atual.detalhado - anterior.detalhado;
  if (!qtd && !valor) return 'sem mudança';
  const sinal = n => (n > 0 ? '+' : '−');
  return [
    qtd ? `${sinal(qtd)}${Math.abs(qtd)} ${Math.abs(qtd) === 1 ? 'compra' : 'compras'}` : null,
    valor ? `${sinal(valor)}${real(Math.abs(valor))}` : null,
  ].filter(Boolean).join(' · ');
}

function blocoHistorico(fatura) {
  const historico = fatura.historico || [];
  if (!historico.length) return '';
  const linhas = historico.map((h, i) => ({ h, mudou: diferenca(h, historico[i - 1]) })).reverse();
  return `
    <section class="secao historico">
      <h2>Histórico de atualizações</h2>
      <ol class="lista-historico">
        ${linhas.map(({ h, mudou }) => `
          <li>
            <div>
              <span class="nome">${esc(h.origem)}</span>
              <span class="detalhe">${quando(h.em)}${h.novas ? ` · ${h.novas} ${h.novas === 1 ? 'nova' : 'novas'}` : ''}</span>
            </div>
            <div class="historico-numeros">
              <strong>${real(h.detalhado)}</strong>
              <span>${h.qtd} ${h.qtd === 1 ? 'compra' : 'compras'}${mudou ? ` · ${mudou}` : ''}</span>
            </div>
          </li>`).join('')}
      </ol>
    </section>`;
}

function telaFatura(id) {
  const fatura = dados.faturas.find(f => f.id === id);
  const cartao = fatura && cartaoDe(fatura.cartaoId);
  if (!cartao) {
    return `
      <div class="vazio">
        <div class="icone">${icone('cartao')}</div>
        <strong>Essa fatura não existe mais</strong>
        <p><a href="#cartoes">Voltar pros cartões</a></p>
      </div>`;
  }

  const colunas = colunasDaFatura(fatura.id);
  const qtd = comprasDa(fatura.id).length;
  const detalhado = detalhadoDa(fatura);

  return `
    <section class="secao primeira fatura-topo">
      <div class="fatura-resumo ${estaVencida(faturaComoConta(fatura)) ? 'vencida' : ''}">
        <div>
          <small>Fatura de ${mesComAno(fatura.mes)} · vence dia ${cartao.vencimento}</small>
          <strong class="numero-painel">${real(valorDaFatura(fatura))}</strong>
        </div>
        ${seloFatura(fatura)}
      </div>
      <form class="valor-banco" data-form="valor-banco" data-id="${fatura.id}">
        <label class="campo"><span>Valor cobrado pelo banco</span>
          <input name="valor" inputmode="decimal" value="${fatura.valorBanco != null ? valorParaCampo(fatura.valorBanco) : ''}" placeholder="Igual ao detalhado" autocomplete="off">
        </label>
        <button class="botao pequeno secundario">Salvar valor</button>
      </form>
      <p class="fatura-detalhado">Detalhado: <strong>${real(detalhado)}</strong> em ${qtd} ${qtd === 1 ? 'compra' : 'compras'}</p>
      ${avisoDiferenca(fatura)}
      <div class="cartao-acoes">
        <a class="botao pequeno secundario" href="#importar/${cartao.id}/${fatura.mes}">${icone('arquivo')} ${qtd ? 'Atualizar fatura' : 'Importar compras'}</a>
        <button class="botao perigo-texto" data-acao="apagar-fatura" data-id="${fatura.id}">Apagar fatura</button>
      </div>
    </section>
    ${qtd ? totaisDasColunas(colunas) : ''}
    ${novaLinha('Nova compra', linhaCompra(null, fatura))}
    <div class="fatura-colunas">
      ${colunas.map(c => `
        <section class="secao coluna-grupo" data-coluna="${c.grupo.id}">
          <h2 class="titulo-dia"><span>${esc(c.grupo.nome)}</span><span>${real(c.total)}</span></h2>
          ${c.compras.length ? `<ul class="lista">${c.compras.map(itemCompra).join('')}</ul>` : '<p class="tudo-certo">Nenhuma compra. Pra trazer uma pra cá, arrastem ou usem o botão ⇆ dela.</p>'}
        </section>`).join('')}
    </div>
    ${blocoHistorico(fatura)}`;
}

// ---------- Importar fatura ----------

function opcoesDeMes(selecionado) {
  const meses = [];
  for (let i = -3; i <= 3; i++) meses.push(somarMeses(mesAtual(), i));
  if (!meses.includes(selecionado)) meses.push(selecionado);
  return meses.sort().map(m => `<option value="${m}" ${m === selecionado ? 'selected' : ''}>${nomeDoMes(m)}</option>`).join('');
}

function itemRevisao(item, i) {
  const especial = item.tipo !== 'compra';
  const campo = nome => `data-i="${i}" data-campo="${nome}"`;
  const valorTexto = item.valor ? valorParaCampo(item.valor) : '';
  return `
    <li class="revisao-item ${item.manter ? '' : 'descartado'} ${item.parcela ? 'parcelada' : ''}">
      ${item.nova ? '<span class="etiqueta-nova">Nova</span>' : ''}
      <div class="revisao-campos">
        <label class="campo r-data"><span>Data</span><input type="date" ${campo('data')} value="${item.data}"></label>
        <label class="campo r-desc"><span>Descrição</span><input ${campo('descricao')} value="${esc(item.descricao)}" placeholder="Ex.: Mercado" autocomplete="off"></label>
        <label class="campo r-cat"><span>Categoria</span><select ${campo('categoriaId')}>${opcoes(dados.categorias, item.categoriaId, 'Sem categoria')}</select></label>
        <label class="campo r-grupo"><span>Pra quem é</span><select ${campo('grupoId')}>${opcoes(dados.grupos, item.grupoId)}</select></label>
        <div class="campo r-parcela"><span>Parcela</span>
          <div class="parcela-par">
            <input ${campo('parcelaAtual')} inputmode="numeric" value="${item.parcela ? item.parcela.atual : ''}" placeholder="–" aria-label="Parcela atual">
            <span>de</span>
            <input ${campo('parcelaTotal')} inputmode="numeric" value="${item.parcela ? item.parcela.total : ''}" placeholder="–" aria-label="Total de parcelas">
          </div>
        </div>
        <label class="campo r-valor"><span>Valor</span><input ${campo('valor')} inputmode="decimal" value="${valorTexto}" placeholder="0,00" autocomplete="off"></label>
        <div class="r-acoes">
          ${especial ? `<label class="marcar pequeno"><input type="checkbox" ${campo('manter')} ${item.manter ? 'checked' : ''}> manter</label>` : ''}
          <button type="button" class="apagar" data-acao="importar-remover" data-i="${i}" aria-label="Remover esta linha">${icone('fechar')}</button>
        </div>
      </div>
      ${especial ? `<p class="etiqueta-linha">${item.tipo === 'pagamento'
        ? 'Parece o pagamento da fatura anterior, não uma compra: começa desmarcado.'
        : 'Valor negativo (estorno ou crédito): diminui a fatura.'}</p>` : ''}
      ${item.descricaoBanco && chaveTexto(item.descricao) !== chaveTexto(item.descricaoBanco)
        ? `<p class="etiqueta-linha">No banco: “${esc(item.descricaoBanco)}”${item.regra ? ' · descrição padrão' : ''}</p>` : ''}
    </li>`;
}

// ---------- Descrições padrão ----------

function linhaRegra(regra) {
  const r = regra || { texto: '', descricao: '', categoriaId: '', grupoId: '' };
  return `
    <form class="linha-form linha-regra" data-form="regra" data-id="${regra ? regra.id : ''}">
      <div class="linha-campos">
        <label class="campo campo-nome"><span>Quando o banco escrever</span><input name="texto" required value="${esc(r.texto)}" placeholder="Ex.: UBER *TRIP" autocomplete="off"></label>
        <label class="campo campo-obs"><span>Trocar por (opcional)</span><input name="descricao" value="${esc(r.descricao)}" placeholder="Ex.: Uber" autocomplete="off"></label>
        <label class="campo"><span>Categoria</span><select name="categoriaId">${opcoes(dados.categorias, r.categoriaId, 'Não mudar')}</select></label>
        <label class="campo"><span>Pra quem é</span><select name="grupoId">${opcoes(dados.grupos, r.grupoId, 'Não mudar')}</select></label>
        ${acoesSimples(regra, 'regra', 'Adicionar')}
      </div>
    </form>`;
}

function itemRegra(regra) {
  if (regra.id === editando) return `<li class="editando">${linhaRegra(regra)}</li>`;
  const grupo = regra.grupoId && grupoDe(regra.grupoId);
  const detalhes = [
    `Banco: “${regra.texto}”`,
    regra.categoriaId ? nomeCategoria(regra.categoriaId) : null,
    grupo ? grupo.nome : null,
    regra.origem === 'aprendida' ? 'aprendida' : 'cadastrada',
  ].filter(Boolean).join(' · ');
  return `
    <li data-busca="${esc(chaveTexto(`${regra.texto} ${regra.descricao}`))}">
      <button class="item-principal" data-acao="editar-regra" data-id="${regra.id}">
        <span class="nome">${esc(regra.descricao || regra.texto)}</span>
        <span class="detalhe">${esc(detalhes)}</span>
      </button>
    </li>`;
}

function telaDescricoes() {
  const regras = [...dados.regras].sort((a, b) => (a.descricao || a.texto).localeCompare(b.descricao || b.texto));
  return `
    <section class="secao primeira">
      <p class="ajuda">Quando a descrição do banco tiver o texto da esquerda, a compra já chega com a descrição, a categoria e a coluna que vocês escolheram. O app também aprende sozinho: cada vez que vocês mudam a descrição, a categoria ou a coluna de uma compra, ele guarda aqui.</p>
    </section>
    ${novaLinha('Nova descrição padrão', linhaRegra())}
    <section class="secao">
      <h2>${regras.length ? `${regras.length} ${regras.length === 1 ? 'descrição padrão' : 'descrições padrão'}` : 'Nenhuma ainda'}</h2>
      ${regras.length > 6 ? '<input class="busca" type="search" data-filtro-regras placeholder="Procurar…" aria-label="Procurar descrição padrão">' : ''}
      ${regras.length
        ? `<ul class="lista lista-regras">${regras.map(itemRegra).join('')}</ul>`
        : '<p class="tudo-certo">Editem a descrição de uma compra na fatura (ou cadastrem acima) e ela aparece aqui.</p>'}
    </section>`;
}

function telaImportar() {
  const imp = importacao;
  if (!dados.cartoes.length || !imp) {
    return `
      <div class="vazio">
        <div class="icone">${icone('cartao')}</div>
        <strong>Primeiro, cadastrem um cartão</strong>
        <p><a href="#cartoes">Ir pros cartões</a></p>
      </div>`;
  }

  if (imp.etapa === 'arquivo') {
    return `
      <section class="secao primeira importar-arquivo">
        <div class="campos-lado">
          <label class="campo"><span>Cartão</span><select data-importar="cartaoId">${opcoes(dados.cartoes, imp.cartaoId)}</select></label>
          <label class="campo"><span>Fatura que vence em</span><select data-importar="mes">${opcoesDeMes(imp.mes)}</select></label>
        </div>
        <label class="soltar-arquivo ${imp.lendo ? 'lendo' : ''}">
          ${icone('arquivo')}
          <strong>${imp.lendo ? esc(imp.lendo) : 'Escolher o arquivo ou os prints da fatura'}</strong>
          <span>CSV do Nubank, PDF do Mercado Pago e do Banco do Brasil, ou prints da tela do aplicativo (pode escolher vários)</span>
          <input type="file" multiple accept=".csv,.pdf,.txt,text/csv,application/pdf,image/*" data-importar-arquivo ${imp.lendo ? 'disabled' : ''}>
        </label>
        ${imp.erro ? `<p class="fatura-aviso">${icone('aviso')}<span>${esc(imp.erro)}</span></p>` : ''}
        <p class="ajuda">Tudo é lido aqui mesmo no navegador: nada é enviado pra internet. Prints dão certo mesmo com a fatura ainda aberta; a primeira leitura de imagem demora alguns segundos.</p>
        <button class="botao secundario" data-acao="importar-na-mao">Adicionar as compras na mão</button>
      </section>`;
  }

  const cartao = cartaoDe(imp.cartaoId);
  const existente = faturaDe(imp.cartaoId, imp.mes);
  const jaTem = existente ? comprasDa(existente.id).length : 0;
  const marcados = imp.itens.filter(i => i.manter);

  return `
    <section class="secao primeira">
      <p class="ajuda">${esc(cartao ? cartao.nome : '')} · fatura que vence em ${mesComAno(imp.mes)}${imp.nomeArquivo ? ` · ${esc(imp.nomeArquivo)}` : ''}</p>
      <h2>Revisem as compras (${imp.itens.length})</h2>
      <p class="ajuda">Confiram a descrição (dá pra editar), a categoria, pra quem é (o padrão é "${esc(dados.grupos[0] ? dados.grupos[0].nome : '')}") e a parcela.
        O que vocês mudarem aqui vira <a href="#descricoes">descrição padrão</a> pras próximas faturas.${imp.itens.some(i => i.regra) ? ` ${imp.itens.filter(i => i.regra).length} já vieram com descrição padrão.` : ''}</p>
      ${imp.deImagem ? `<p class="fatura-aviso">${icone('aviso')}<span>Lido de prints: a leitura de imagem pode errar letras e números. Confiram os valores com a tela do aplicativo.</span></p>` : ''}
      <div class="campos-lado">
        <label class="campo"><span>Valor cobrado pelo banco</span><input data-importar="valorBanco" inputmode="decimal" value="${imp.valorBanco != null ? valorParaCampo(imp.valorBanco) : ''}" placeholder="Ex.: 3.168,58" autocomplete="off"></label>
        <div class="campo"><span>Detalhado (soma das marcadas)</span><strong class="detalhado-total" id="detalhado-total">${real(soma(marcados))}</strong></div>
      </div>
      ${jaTem ? `
        <label class="marcar"><input type="checkbox" data-importar="substituir" ${imp.substituir ? 'checked' : ''}> Atualizar a fatura: trocar as ${jaTem} ${jaTem === 1 ? 'compra que já está' : 'compras que já estão'} lá por esta lista</label>
        <p class="ajuda">${imp.substituir
          ? `As compras iguais continuam com a descrição, a categoria e a coluna que vocês já tinham escolhido. As que não estavam lá aparecem como <strong>Nova</strong> (${imp.itens.filter(i => i.nova).length}).`
          : 'Desmarcado: as compras desta lista são somadas às que já estão lá.'}</p>` : ''}
    </section>
    <section class="secao revisao">
      <div class="revisao-cabecalho" aria-hidden="true">
        <span>Data</span><span>Descrição</span><span>Categoria</span><span>Pra quem é</span><span>Parcela</span><span>Valor</span><span></span>
      </div>
      ${imp.itens.length ? `<ul class="lista-revisao">${imp.itens.map(itemRevisao).join('')}</ul>` : '<p class="tudo-certo">Nenhuma compra na lista.</p>'}
      <button class="botao secundario" data-acao="importar-adicionar-linha">+ Adicionar compra na mão</button>
    </section>
    <div class="revisao-rodape">
      <button class="botao secundario" data-acao="importar-cancelar">Cancelar</button>
      <button class="botao" data-acao="importar-salvar">Salvar fatura</button>
    </div>`;
}
