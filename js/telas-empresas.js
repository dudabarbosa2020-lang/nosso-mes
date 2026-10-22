// Nosso Mês — tela Empresas: quanto cada empresa gastou do dinheiro de vocês, quanto já devolveu e quanto falta.

function linhaDevolucao(empresa) {
  return `
    <form class="linha-form linha-devolucao" data-form="devolucao" data-grupo="${empresa.grupo.id}">
      <div class="linha-campos">
        <label class="campo"><span>Quanto devolveu</span><input name="valor" required inputmode="decimal" value="${empresa.falta ? valorParaCampo(empresa.falta) : ''}" placeholder="0,00" autocomplete="off"></label>
        <label class="campo"><span>Quando</span><input name="data" type="date" required value="${hojeISO()}"></label>
        <label class="campo campo-obs"><span>Observação (opcional)</span><input name="observacao" placeholder="Ex.: Pix pra conta da Eduarda" autocomplete="off"></label>
        <div class="linha-acoes editar">
          <button type="button" class="botao pequeno secundario" data-acao="cancelar-devolucao">Cancelar</button>
          <button class="botao pequeno">Salvar devolução</button>
        </div>
      </div>
    </form>`;
}

function itemDaEmpresa(item) {
  const acao = item.naoVolta
    ? `<button class="botao-texto" data-acao="vai-voltar" data-tipo="${item.tipo}" data-id="${item.id}">Vai voltar</button>`
    : `<button class="botao-texto" data-acao="nao-volta" data-tipo="${item.tipo}" data-id="${item.id}">Não vai voltar</button>`;
  return `
    <li class="${item.naoVolta ? 'nao-volta' : ''}">
      <div class="item-principal">
        <span class="nome">${esc(item.nome)}</span>
        <span class="detalhe">${esc(item.origem)}${item.naoVolta ? ' · não vai voltar' : ''}</span>
      </div>
      <div class="item-lado"><span class="quanto">${real(item.valor)}</span>${acao}</div>
    </li>`;
}

function painelEmpresa(empresa) {
  const mes = nomeDoMes(mesVisivel, false);
  const progresso = empresa.aReceber > 0 ? Math.min(100, (empresa.devolvido / empresa.aReceber) * 100) : 0;

  let destaque;
  if (!empresa.gasto) destaque = `<p class="empresa-zero">✓ Nada no dinheiro de vocês em ${mes}</p>`;
  else if (empresa.falta) destaque = `<p class="ajuda">Falta devolver de ${mes}</p><p class="numero-painel">${real(empresa.falta)}</p>`;
  else if (empresa.aMais) destaque = `<p class="ajuda">Devolveu a mais em ${mes}</p><p class="numero-painel">${real(empresa.aMais)}</p>`;
  else destaque = `<p class="ajuda">${mes}</p><p class="numero-painel">Tudo devolvido ✓</p>`;

  const devolucoes = empresa.devolucoes.length ? `
    <h3>Devoluções</h3>
    <ul class="lista">
      ${empresa.devolucoes.map(d => `
        <li>
          <div class="item-principal">
            <span class="nome">${real(d.valor)}</span>
            <span class="detalhe">${dataCurta(d.data)}${d.observacao ? ` · ${esc(d.observacao)}` : ''}</span>
          </div>
          <button class="apagar" data-acao="apagar-devolucao" data-id="${d.id}" aria-label="Apagar devolução de ${real(d.valor)}">${icone('fechar')}</button>
        </li>`).join('')}
    </ul>` : '';

  return `
    <section class="secao empresa-painel">
      <div class="cartao-topo">
        <span class="cartao-marca" aria-hidden="true">${icone('empresa')}</span>
        <div class="cartao-nome"><h2>${esc(empresa.nome)}</h2></div>
      </div>
      ${destaque}
      ${empresa.gasto ? `
        <div class="medidor" aria-hidden="true"><div style="width:${progresso}%"></div></div>
        <div class="resumo">
          <div><small>Gastou</small><strong>${real(empresa.gasto)}</strong></div>
          <div><small>Vai voltar</small><strong>${real(empresa.aReceber)}</strong></div>
          <div><small>Já devolveu</small><strong>${real(empresa.devolvido)}</strong></div>
        </div>
        ${empresa.naoVolta ? `<p class="ajuda">${real(empresa.naoVolta)} não vai voltar (ficou fora do que a empresa devolve).</p>` : ''}
        ${devolvendo === empresa.grupo.id ? linhaDevolucao(empresa) : `<button class="botao" data-acao="devolver" data-id="${empresa.grupo.id}">Devolveu</button>`}
        ${devolucoes}
        <h3>De onde veio (${empresa.itens.length})</h3>
        <ul class="lista">${empresa.itens.map(itemDaEmpresa).join('')}</ul>` : ''}
    </section>`;
}

// Mês a mês, quanto cada empresa usou do dinheiro de vocês; mês com zero é conquista
function blocoHistoricoEmpresas(empresas) {
  const historico = historicoEmpresas(mesVisivel);
  if (historico.length < 2) return '';
  const celula = (linha, j, i) => {
    const e = linha.empresas[j];
    const anterior = historico[i + 1] && historico[i + 1].empresas[j];
    let comparacao = '';
    if (anterior) {
      const diferenca = e.gasto - anterior.gasto;
      const mesAnterior = nomeDoMes(historico[i + 1].mes, false);
      comparacao = diferenca < 0 ? `${real(-diferenca)} a menos que ${mesAnterior}`
        : diferenca > 0 ? `${real(diferenca)} a mais que ${mesAnterior}` : `igual a ${mesAnterior}`;
    }
    const valor = e.gasto === 0 ? '<strong class="conquista">✓ Zero</strong>' : `<strong>${real(e.gasto)}</strong>`;
    return `
      <td class="numero">
        ${valor}
        ${comparacao ? `<small>${comparacao}</small>` : ''}
        ${e.falta ? `<small>falta voltar ${real(e.falta)}</small>` : ''}
      </td>`;
  };
  return `
    <section class="secao historico-empresas">
      <h2>Mês a mês</h2>
      <p class="ajuda">Quanto cada empresa usou dos cartões e das contas de vocês. A meta é zero: mês sem nada aparece com ✓.</p>
      <table class="tabela-historico">
        <thead><tr><th scope="col">Mês</th>${empresas.map(e => `<th scope="col" class="numero">${esc(e.nome)}</th>`).join('')}</tr></thead>
        <tbody>
          ${historico.map((linha, i) => `
            <tr>
              <th scope="row">${nomeDoMes(linha.mes)}</th>
              ${empresas.map((_, j) => celula(linha, j, i)).join('')}
            </tr>`).join('')}
        </tbody>
      </table>
    </section>`;
}

function telaEmpresas() {
  const empresas = empresasDoMes(mesVisivel);
  if (!empresas.length) {
    return `
      <div class="vazio">
        <div class="icone">${icone('empresa')}</div>
        <strong>Nenhum grupo marcado como empresa</strong>
        <p>Em Ajustes, marquem "empresa" nos grupos que devolvem o dinheiro (como Eventique e Loja).</p>
        <div class="vazio-acoes"><a class="botao" href="#ajustes">Ir pros Ajustes</a></div>
      </div>`;
  }
  return `<div class="grade-empresas">${empresas.map(painelEmpresa).join('')}</div>${blocoHistoricoEmpresas(empresas)}`;
}
