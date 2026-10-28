// Nosso Mês — o desenho de cada tela (transforma os dados em HTML).

function esc(texto) {
  const trocas = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(texto ?? '').replace(/[&<>"']/g, c => trocas[c]);
}

function dataCurta(iso) {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
}

// Ícones de traço fino (desenhos do Lucide), sempre ao lado de um texto ou com aria-label no botão
const desenhos = {
  anterior: '<path d="m15 18-6-6 6-6"/>',
  seguinte: '<path d="m9 18 6-6-6-6"/>',
  fechar: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  enviar: '<path d="M14.5 21.7a.5.5 0 0 0 .9 0l6.5-19a.5.5 0 0 0-.6-.6l-19 6.5a.5.5 0 0 0 0 .9l7.9 3.2a2 2 0 0 1 1.1 1.1z"/><path d="m21.9 2.1-11 11"/>',
  calendario: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  recibo: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/>',
  carteira: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  cartao: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>',
  arquivo: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 18v-6"/><path d="m9 15 3-3 3 3"/>',
  empresa: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  ajustes: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
  mover: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  nota: '<path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/>',
  aviso: '<path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
};

function icone(nome) {
  return `<svg class="icone-svg" viewBox="0 0 24 24" aria-hidden="true">${desenhos[nome]}</svg>`;
}

function seletorMes() {
  return `
    <div class="seletor-mes">
      <button data-acao="mes-anterior" aria-label="Mês anterior">${icone('anterior')}</button>
      <button class="mes-nome" data-acao="mes-atual" title="Voltar pro mês atual">${nomeDoMes(mesVisivel)}</button>
      <button data-acao="mes-seguinte" aria-label="Próximo mês">${icone('seguinte')}</button>
    </div>`;
}

function opcoes(lista, selecionado, textoVazio) {
  const vazio = textoVazio ? `<option value="">${textoVazio}</option>` : '';
  return vazio + lista.map(i => `<option value="${i.id}" ${i.id === selecionado ? 'selected' : ''}>${esc(i.nome)}</option>`).join('');
}

// ---------- Peças das listas ----------

// Fatura na lista de contas: toca e abre a fatura; "Paguei" marca a fatura
function itemFatura(fatura) {
  const vencida = estaVencida(fatura);
  const deOutroMes = fatura.mes !== mesVisivel ? ` de ${nomeDoMes(fatura.mes, false)}` : '';
  const qtd = comprasDa(fatura.id).length;
  const detalhes = [
    vencida ? `venceu dia ${fatura.dia}${deOutroMes}` : `dia ${fatura.dia}`,
    'fatura do cartão',
    qtd ? `${qtd} ${qtd > 1 ? 'compras' : 'compra'}` : null,
  ].filter(Boolean).join(' · ');

  const situacao = fatura.pagaEm
    ? `<button class="selo feito" data-acao="desfazer-pagamento-fatura" data-id="${fatura.id}" title="Toque pra desfazer">Pago ${dataCurta(fatura.pagaEm)}</button>`
    : `<button class="selo" data-acao="pagar-fatura" data-id="${fatura.id}">Paguei</button>`;

  return `
    <li class="${vencida ? 'vencida' : ''}">
      <a class="item-principal" href="#fatura/${fatura.id}">
        <span class="nome">${icone('cartao')} ${esc(fatura.nome)}</span>
        <span class="detalhe">${esc(detalhes)}</span>
      </a>
      <div class="item-lado"><span class="quanto">${real(fatura.valor)}</span>${situacao}</div>
    </li>`;
}

function itemConta(conta) {
  if (conta.tipo === 'fatura') return itemFatura(conta);
  if (conta.id === editando) return `<li class="editando">${linhaConta(conta)}</li>`;
  const vencida = estaVencida(conta);
  const grupo = grupoDe(conta.grupoId);
  const deOutroMes = conta.mes !== mesVisivel ? ` de ${nomeDoMes(conta.mes, false)}` : '';
  const detalhes = [
    vencida ? `venceu dia ${conta.dia}${deOutroMes}` : `dia ${conta.dia}`,
    nomeCategoria(conta.categoriaId),
    grupo && grupo.empresa ? grupo.nome : null,
    conta.serieId ? '↻ todo mês' : null,
  ].filter(Boolean).join(' · ');

  const situacao = conta.pagaEm
    ? `<button class="selo feito" data-acao="desfazer-pagamento" data-id="${conta.id}" title="Toque pra desfazer">Pago ${dataCurta(conta.pagaEm)}</button>`
    : `<button class="selo" data-acao="pagar" data-id="${conta.id}">Paguei</button>`;

  return `
    <li class="${vencida ? 'vencida' : ''}">
      <button class="item-principal" data-acao="editar-conta" data-id="${conta.id}">
        <span class="nome">${esc(conta.nome)}</span>
        <span class="detalhe">${esc(detalhes)}</span>
      </button>
      <div class="item-lado"><span class="quanto">${real(conta.valor)}</span>${situacao}</div>
    </li>`;
}

function itemGanho(ganho) {
  if (ganho.id === editando) return `<li class="editando">${linhaGanho(ganho)}</li>`;
  const detalhes = [nomePessoa(ganho.pessoa), ganho.observacao, ganho.serieId ? '↻ todo mês' : null].filter(Boolean).join(' · ');
  const situacao = ganho.recebidoEm
    ? `<button class="selo feito" data-acao="desfazer-recebimento" data-id="${ganho.id}" title="Toque pra desfazer">Recebido ${dataCurta(ganho.recebidoEm)}</button>`
    : `<button class="selo" data-acao="receber" data-id="${ganho.id}">Recebi</button>`;

  return `
    <li>
      <button class="item-principal" data-acao="editar-ganho" data-id="${ganho.id}">
        <span class="nome">${esc(ganho.descricao)}</span>
        <span class="detalhe">${esc(detalhes)}</span>
      </button>
      <div class="item-lado"><span class="quanto">${real(ganho.valor)}</span>${situacao}</div>
    </li>`;
}

function resumoEmTres(itens) {
  return `<div class="resumo">${itens.map(([rotulo, valor]) => `<div><small>${rotulo}</small><strong>${real(valor)}</strong></div>`).join('')}</div>`;
}

// ---------- Telas ----------

function telaInicio() {
  const r = resumoDoMes(mesVisivel);
  const vencidas = vencidasPara(mesVisivel);
  const mes = nomeDoMes(mesVisivel, false);

  if (!r.ganhos.length && !r.pagaveis.length && !vencidas.length) {
    return `
      <div class="vazio">
        <div class="icone">${icone('calendario')}</div>
        <strong>Vamos montar ${mes}?</strong>
        <p>Cadastrem o que vocês esperam receber e as contas do mês. O app faz a conta do resto.</p>
        <div class="vazio-acoes">
          <button class="botao" data-acao="novo-ganho">+ Ganho</button>
          <button class="botao secundario" data-acao="nova-conta">+ Conta</button>
        </div>
      </div>`;
  }

  const proximas = r.pagaveis.filter(c => !c.pagaEm && !estaVencida(c)).sort(porVencimento);
  const entraTudo = r.entra + r.reembolso; // ganhos + o que as empresas devolvem
  const usado = entraTudo > 0 ? Math.min(100, (r.sai / entraTudo) * 100) : (r.sai > 0 ? 100 : 0);
  const positiva = r.folga >= 0;

  let listaProximas;
  if (proximas.length) {
    listaProximas = `<ul class="lista">${proximas.slice(0, 5).map(itemConta).join('')}</ul>`;
    if (proximas.length > 5) listaProximas += `<a class="ver-todas" href="#contas">Ver todas (${proximas.length}) →</a>`;
  } else {
    listaProximas = `<p class="tudo-certo">${r.pagaveis.length ? 'Nenhuma conta pendente neste mês ✓' : 'Nenhuma conta cadastrada neste mês.'}</p>`;
  }

  // Números da barra: quanto do que entra já está comprometido e quanto sobra (ou passou)
  let numerosBarra = '';
  if (entraTudo > 0) {
    numerosBarra = `
      <div class="barra-numeros">
        <span><strong>${real(r.sai)}</strong> comprometido</span>
        <span>${positiva ? `<strong>${real(r.folga)}</strong> livre` : `passou <strong>${real(-r.folga)}</strong>`}</span>
      </div>`;
  }

  return `
    <div class="grade-inicio">
      <div class="area-folga">
        <section class="cartao folga">
          <p class="rotulo">Folga de ${mes}</p>
          <p class="valor ${positiva ? 'positivo' : 'negativo'}">${real(r.folga)}</p>
          <p class="legenda">${positiva ? 'ainda dá pra gastar' : `passamos ${real(-r.folga)} do que ganhamos`}</p>
          <div class="barra-uso" aria-hidden="true"><div style="width:${usado}%"></div></div>
          ${numerosBarra}
          <div class="entrou-saiu">
            <div>
              <small>Entra</small><strong>${real(entraTudo)}</strong>
              <small>já entrou ${real(r.recebido + r.devolvido)}</small>
              ${r.reembolso ? `<small>inclui ${real(r.reembolso)} das empresas</small>` : ''}
            </div>
            <div><small>Sai</small><strong>${real(r.sai)}</strong><small>já pagamos ${real(r.pago)}</small></div>
          </div>
          <button class="botao" data-acao="compartilhar">${icone('enviar')} Compartilhar no WhatsApp</button>
        </section>
      </div>
      <div class="area-contas">
        ${vencidas.length ? `
          <section class="secao alerta">
            <h2>${vencidas.length > 1 ? 'Vencidas' : 'Vencida'}</h2>
            <ul class="lista">${vencidas.map(itemConta).join('')}</ul>
          </section>` : ''}
        <section class="secao">
          <h2>Próximas contas</h2>
          ${listaProximas}
        </section>
      </div>
      ${blocoCartoesEmpresas()}
      ${blocoCategorias()}
    </div>`;
}

// "Já comprometido no cartão pro mês que vem" e "quanto das saídas é das empresas"
function blocoCartoesEmpresas() {
  const comprometido = dados.cartoes.length ? comprometidoProximoMes(mesVisivel) : 0;
  const empresas = empresasNoMes(mesVisivel);
  if (!dados.cartoes.length && !empresas.length) return '';
  const proximo = nomeDoMes(somarMeses(mesVisivel, 1), false);
  const totalEmpresas = soma(empresas);
  const aVoltar = empresasDoMes(mesVisivel).filter(e => e.aReceber > 0);
  const faltam = aVoltar.filter(e => e.falta > 0);
  const linhaFalta = !aVoltar.length ? ''
    : faltam.length
      ? `<li><a class="aviso-link" href="#empresas"><span>Falta ${faltam.map(e => `a ${esc(e.nome)} devolver <strong>${real(e.falta)}</strong>`).join(' · ')}</span>${icone('seguinte')}</a></li>`
      : `<li><a class="aviso-link" href="#empresas"><span>As empresas já devolveram tudo deste mês ✓</span>${icone('seguinte')}</a></li>`;

  return `
    <section class="secao area-avisos">
      <ul class="lista-avisos">
        ${dados.cartoes.length ? `
          <li>
            <span>Já comprometido no cartão pro mês que vem (${proximo})</span>
            <strong>${real(comprometido)}</strong>
          </li>` : ''}
        ${empresas.length ? `
          <li>
            <span>Das saídas do mês, <strong>${real(totalEmpresas)}</strong> são das empresas</span>
            <small>${empresas.map(e => `${esc(e.nome)} ${real(e.valor)}`).join(' · ')}</small>
          </li>` : ''}
        ${linhaFalta}
      </ul>
    </section>`;
}

// Valor sem o "R$", pra tabela onde a coluna já diz que é em reais
const formatoNumero = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// "Para onde foi o dinheiro": tabela Categoria / R$ / %, do maior pro menor.
// Embaixo de cada categoria, uma barrinha (a maior ocupa a largura toda); o % é a fatia de tudo o que sai no mês.
function blocoCategorias() {
  const categorias = porCategoria(mesVisivel);
  if (!categorias.length) return '';
  const maior = categorias[0].valor;
  const total = soma(categorias);

  const linhas = categorias.map(({ nome, valor }) => {
    const largura = maior > 0 ? Math.max(2, (valor / maior) * 100) : 0;
    const fatia = total > 0 ? Math.round((valor / total) * 100) : 0;
    return `
      <tr>
        <td>
          <span class="nome">${esc(nome)}</span>
          <div class="categoria-barra" aria-hidden="true"><div style="width:${largura}%"></div></div>
        </td>
        <td class="numero">${formatoNumero.format(valor / 100)}</td>
        <td class="numero fatia">${fatia}%</td>
      </tr>`;
  }).join('');

  return `
    <section class="secao area-categorias">
      <h2>Para onde foi o dinheiro</h2>
      <p class="ajuda">Contas e compras do cartão de ${nomeDoMes(mesVisivel, false)}, por categoria</p>
      <table class="tabela-categorias">
        <thead><tr><th scope="col">Categoria</th><th scope="col" class="numero">R$</th><th scope="col" class="numero">%</th></tr></thead>
        <tbody>${linhas}</tbody>
        <tfoot><tr><th scope="row">Total</th><td class="numero">${formatoNumero.format(total / 100)}</td><td class="numero fatia">100%</td></tr></tfoot>
      </table>
    </section>`;
}

function telaContas() {
  const r = resumoDoMes(mesVisivel);
  const nova = novaLinha(`Nova conta em ${nomeDoMes(mesVisivel, false)}`, linhaConta());

  if (!r.pagaveis.length) {
    return `
      <div class="vazio">
        <div class="icone">${icone('recibo')}</div>
        <strong>Nenhuma conta em ${nomeDoMes(mesVisivel, false)}</strong>
        <p>Energia, água, seguro, fatura do cartão… Preencham a linha abaixo com o dia do vencimento.</p>
      </div>
      ${nova}`;
  }

  // Contas e faturas juntas, agrupadas pelo dia do vencimento
  const dias = [...new Set(r.pagaveis.map(c => c.dia))].sort((a, b) => a - b);
  const grupos = dias.map(dia => {
    const doDia = r.pagaveis.filter(c => c.dia === dia).sort((a, b) => a.nome.localeCompare(b.nome));
    return `
      <section class="secao">
        <h2 class="titulo-dia"><span>Dia ${dia}</span><span>${real(soma(doDia))}</span></h2>
        <ul class="lista">${doDia.map(itemConta).join('')}</ul>
      </section>`;
  }).join('');

  return resumoEmTres([['Total do mês', r.sai], ['Já pagamos', r.pago], ['Falta pagar', r.sai - r.pago]]) + nova + grupos;
}

function telaGanhos() {
  const r = resumoDoMes(mesVisivel);
  const nova = novaLinha(`Novo ganho em ${nomeDoMes(mesVisivel, false)}`, linhaGanho());

  if (!r.ganhos.length) {
    return `
      <div class="vazio">
        <div class="icone">${icone('carteira')}</div>
        <strong>Nada previsto em ${nomeDoMes(mesVisivel, false)}</strong>
        <p>Salários, freelas, vendas… Preencham a linha abaixo com tudo o que vocês esperam receber no mês.</p>
      </div>
      ${nova}`;
  }

  const ordenados = [...r.ganhos].sort((a, b) =>
    Boolean(a.recebidoEm) - Boolean(b.recebidoEm) || a.descricao.localeCompare(b.descricao));

  const recebidoPct = r.entra > 0 ? Math.min(100, (r.recebido / r.entra) * 100) : 0;
  const painel = `
    <section class="secao primeira painel-recebido">
      <p class="ajuda">Previsto em ${nomeDoMes(mesVisivel, false)}</p>
      <p class="numero-painel">${real(r.entra)}</p>
      <div class="medidor" aria-hidden="true"><div style="width:${recebidoPct}%"></div></div>
      <div class="painel-rodape">
        <span>Já recebemos <strong>${real(r.recebido)}</strong> de <strong>${real(r.entra)}</strong></span>
        ${r.recebido < r.entra ? `<span>Falta <strong>${real(r.entra - r.recebido)}</strong></span>` : '<span>Tudo recebido ✓</span>'}
      </div>
    </section>`;

  return painel + nova + `
    <section class="secao">
      <ul class="lista">${ordenados.map(itemGanho).join('')}</ul>
    </section>`;
}

function telaAjustes() {
  const linhaEditavel = (tipo, item, extra = '') => `
    <li>
      <input data-renomear="${tipo}" data-id="${item.id}" value="${esc(item.nome)}" aria-label="Nome">
      ${extra}
      <button class="apagar" data-acao="apagar-${tipo}" data-id="${item.id}" aria-label="Apagar ${esc(item.nome)}">${icone('fechar')}</button>
    </li>`;

  return `
    <section class="secao primeira">
      <h2>Vocês dois</h2>
      <div class="campos-lado">
        <label class="campo"><span>Nome 1</span><input data-ajuste="pessoa1" value="${esc(dados.casal.pessoa1)}"></label>
        <label class="campo"><span>Nome 2</span><input data-ajuste="pessoa2" value="${esc(dados.casal.pessoa2)}"></label>
      </div>
    </section>

    <section class="secao">
      <h2>Pra quem é</h2>
      <p class="ajuda">Separe o que é de vocês e o que é das empresas. Marque "empresa" nas que devolvem o dinheiro.</p>
      <ul class="lista-edicao">
        ${dados.grupos.map(g => linhaEditavel('grupo', g,
          `<label class="marcar pequeno"><input type="checkbox" data-empresa data-id="${g.id}" ${g.empresa ? 'checked' : ''}> empresa</label>`)).join('')}
      </ul>
      <form class="adicionar-linha" data-form="novo-grupo">
        <input name="nome" placeholder="Novo grupo" required>
        <button class="botao pequeno">Adicionar</button>
      </form>
    </section>

    <section class="secao">
      <h2>Categorias</h2>
      <ul class="lista-edicao">${dados.categorias.map(c => linhaEditavel('categoria', c)).join('')}</ul>
      <form class="adicionar-linha" data-form="nova-categoria">
        <input name="nome" placeholder="Nova categoria" required>
        <button class="botao pequeno">Adicionar</button>
      </form>
    </section>

    <section class="secao">
      <h2>Conta</h2>
      <p class="ajuda">Logada como <strong>${esc(emailLogado())}</strong>.</p>
      ${minhaPessoa ? `<p class="ajuda">Nas anotações, você aparece como <strong>${esc(nomePessoa(minhaPessoa))}</strong>. <button class="botao-texto" data-acao="trocar-pessoa">Trocar</button></p>` : ''}
      <button class="botao secundario" data-acao="sair">Sair da conta</button>
    </section>

    ${codigoDoCofre() ? `
    <section class="secao">
      <h2>Cofre do casal</h2>
      <p class="ajuda">Código pra outra pessoa entrar no mesmo financeiro (ela cria a conta e escolhe “Entrar com um código”):</p>
      <p class="cofre-codigo-mini">${esc(codigoDoCofre())}</p>
    </section>` : ''}

    <section class="secao">
      <h2>Dados</h2>
      <p class="ajuda">Por enquanto, tudo fica salvo só neste navegador. Na fase final, vocês dois vão ver os mesmos dados.</p>
      <button class="botao perigo" data-acao="apagar-tudo">Apagar tudo e começar do zero</button>
    </section>`;
}

// ---------- Linhas de preenchimento (como numa planilha, sem janela por cima) ----------
// A mesma linha serve pra cadastrar (sem item) e pra editar (com item, aberta no lugar dele na lista).

function acoesLinha(item, tipo) {
  if (!item) {
    return `
      <label class="marcar campo-repete"><input type="checkbox" name="repete"><span>Repete<span class="texto-longo"> todo mês</span></span></label>
      <div class="linha-acoes"><button class="botao pequeno">Adicionar</button></div>`;
  }
  return `
    <div class="linha-acoes editar">
      <button type="button" class="botao perigo-texto" data-acao="apagar-${tipo}" data-id="${item.id}">Apagar</button>
      <button type="button" class="botao pequeno secundario" data-acao="cancelar-edicao">Cancelar</button>
      <button class="botao pequeno">Salvar</button>
    </div>`;
}

// Ao editar algo já pago/recebido, dá pra corrigir a data; o resto se marca no "Paguei"/"Recebi" da lista
function campoData(rotulo, data) {
  if (!data) return '';
  return `
    <input type="hidden" name="feito" value="1">
    <label class="campo campo-data"><span>${rotulo}</span><input type="date" name="data" value="${data}"></label>`;
}

function avisoRepete(item) {
  return item && item.serieId
    ? `<p class="ajuda linha-aviso">↻ Repete todo mês: esta mudança vale só pra ${nomeDoMes(item.mes, false)}.</p>`
    : '';
}

function linhaConta(conta) {
  const c = conta || { nome: '', valor: null, dia: '', categoriaId: '', grupoId: dados.grupos[0] && dados.grupos[0].id, pagaEm: null };
  return `
    <form class="linha-form linha-conta" data-form="conta" data-id="${conta ? conta.id : ''}">
      <div class="linha-campos">
        <label class="campo campo-nome"><span>Nome</span><input name="nome" required value="${esc(c.nome)}" placeholder="Ex.: Energia" autocomplete="off"></label>
        <label class="campo"><span>Valor</span><input name="valor" required inputmode="decimal" value="${c.valor != null ? valorParaCampo(c.valor) : ''}" placeholder="0,00" autocomplete="off"></label>
        <label class="campo"><span>Dia</span><input name="dia" required type="number" min="1" max="31" inputmode="numeric" value="${c.dia}" placeholder="10"></label>
        <label class="campo"><span>Categoria</span><select name="categoriaId">${opcoes(dados.categorias, c.categoriaId, 'Sem categoria')}</select></label>
        <label class="campo"><span>Pra quem é</span><select name="grupoId">${opcoes(dados.grupos, c.grupoId)}</select></label>
        ${campoData('Paga em', c.pagaEm)}
        ${acoesLinha(conta, 'conta')}
      </div>
      ${avisoRepete(conta)}
    </form>`;
}

function linhaGanho(ganho) {
  const g = ganho || { descricao: '', valor: null, pessoa: 'p1', observacao: '', recebidoEm: null };
  const pessoas = [{ id: 'p1', nome: dados.casal.pessoa1 }, { id: 'p2', nome: dados.casal.pessoa2 }, { id: 'casal', nome: 'Os dois' }];
  return `
    <form class="linha-form linha-ganho" data-form="ganho" data-id="${ganho ? ganho.id : ''}">
      <div class="linha-campos">
        <label class="campo campo-nome"><span>Descrição</span><input name="descricao" required value="${esc(g.descricao)}" placeholder="Ex.: Salário Loja" autocomplete="off"></label>
        <label class="campo"><span>Valor</span><input name="valor" required inputmode="decimal" value="${g.valor != null ? valorParaCampo(g.valor) : ''}" placeholder="0,00" autocomplete="off"></label>
        <label class="campo"><span>De quem</span><select name="pessoa">${opcoes(pessoas, g.pessoa)}</select></label>
        <label class="campo campo-obs"><span>Observação</span><input name="observacao" value="${esc(g.observacao)}" placeholder="Ex.: Pix Eduarda" autocomplete="off"></label>
        ${campoData('Recebido em', g.recebidoEm)}
        ${acoesLinha(ganho, 'ganho')}
      </div>
      ${avisoRepete(ganho)}
    </form>`;
}

function novaLinha(titulo, linha) {
  return `
    <section class="secao nova-linha">
      <h2>${titulo}</h2>
      ${linha}
    </section>`;
}

function formPergunta(titulo, texto, escolhas) {
  return `
    <div class="formulario">
      <h2>${titulo}</h2>
      <p class="ajuda">${texto}</p>
      <div class="acoes-form coluna">
        ${escolhas.map((e, i) => `<button type="button" class="botao ${e.estilo || ''}" data-escolha="${i}">${e.texto}</button>`).join('')}
      </div>
    </div>`;
}
