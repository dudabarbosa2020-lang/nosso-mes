// Nosso Mês — o portão de entrada (login) e o cofre do casal.
// Sem login, o app não abre. Depois de logar, resolvemos o "cofre" compartilhado
// (o espaço que Eduarda e Lucas dividem). No sub-passo 3, carregamos os dados do Supabase.

let sessao = null;
let casalId = null;
let cofre = null;            // { id, nome_pessoa1, nome_pessoa2, codigo_convite }
let modoCadastro = false;    // portão: entrar x criar conta
let modoCofre = 'escolher';  // cofre: escolher | criar | entrar | pronto

function emailLogado() {
  return sessao && sessao.user ? sessao.user.email : '';
}

function codigoDoCofre() {
  return cofre ? cofre.codigo_convite : '';
}

// ---------- A "porta" na frente do app (login ou cofre) ----------

function abrirGate(html) {
  document.querySelector('.app').hidden = true;
  let gate = document.getElementById('portao');
  if (!gate) {
    gate = document.createElement('div');
    gate.id = 'portao';
    document.body.appendChild(gate);
  }
  gate.hidden = false;
  gate.innerHTML = html;
  const campo = gate.querySelector('input');
  if (campo) campo.focus();
}

function fecharGate() {
  const gate = document.getElementById('portao');
  if (gate) gate.hidden = true;
  document.querySelector('.app').hidden = false;
}

function mostrarErroGate(texto) {
  const p = document.querySelector('.portao-erro');
  if (p) { p.textContent = texto; p.hidden = false; }
}

// ---------- Tela de login ----------

function telaDoPortao() {
  const titulo = modoCadastro ? 'Criar conta' : 'Entrar';
  const troca = modoCadastro
    ? 'Já têm conta? <button type="button" data-portao="entrar">Entrar</button>'
    : 'Primeira vez aqui? <button type="button" data-portao="cadastrar">Criar conta</button>';
  return `
    <div class="portao-cartao">
      <span class="nome-app">Nosso Mês</span>
      <p class="portao-sub">O financeiro de vocês, num lugar só.</p>
      <form class="portao-form" data-form-portao>
        <label class="campo"><span>E-mail</span>
          <input name="email" type="email" required autocomplete="email" placeholder="voce@email.com"></label>
        <label class="campo"><span>Senha</span>
          <input name="senha" type="password" required minlength="6" placeholder="pelo menos 6 letras"
            autocomplete="${modoCadastro ? 'new-password' : 'current-password'}"></label>
        <p class="portao-erro" hidden></p>
        <button class="botao">${titulo}</button>
      </form>
      <p class="portao-troca">${troca}</p>
    </div>`;
}

function mostrarPortao() {
  abrirGate(telaDoPortao());
}

// ---------- Tela do cofre (primeira vez) ----------

function telaOnboarding() {
  if (modoCofre === 'pronto' && cofre) {
    const outra = cofre.nome_pessoa2 || 'a outra pessoa';
    return `
      <div class="portao-cartao">
        <span class="nome-app">Cofre criado! 🎉</span>
        <p class="portao-sub">Este é o código pra ${esc(outra)} entrar no mesmo financeiro:</p>
        <p class="cofre-codigo">${esc(cofre.codigo_convite)}</p>
        <p class="portao-ajuda">A outra pessoa cria a conta dela, escolhe <strong>“Entrar com um código”</strong> e digita isso. Você reencontra esse código em Ajustes.</p>
        <button class="botao" data-cofre="abrir-app">Entrar no app</button>
      </div>`;
  }
  if (modoCofre === 'criar') {
    const casal = (typeof dados !== 'undefined' && dados.casal) ? dados.casal : {};
    return `
      <div class="portao-cartao">
        <span class="nome-app">Criar o cofre</span>
        <p class="portao-sub">O cofre guarda o financeiro de vocês dois.</p>
        <form class="portao-form" data-form-cofre="criar">
          <label class="campo"><span>Nome da primeira pessoa</span>
            <input name="nome1" required placeholder="Ex.: Eduarda" value="${esc(casal.pessoa1 || '')}"></label>
          <label class="campo"><span>Nome da segunda pessoa</span>
            <input name="nome2" placeholder="Ex.: Lucas" value="${esc(casal.pessoa2 || '')}"></label>
          <p class="portao-erro" hidden></p>
          <button class="botao">Criar cofre</button>
        </form>
        <p class="portao-troca"><button type="button" data-cofre="escolher">‹ Voltar</button></p>
      </div>`;
  }
  if (modoCofre === 'entrar') {
    return `
      <div class="portao-cartao">
        <span class="nome-app">Entrar no cofre</span>
        <p class="portao-sub">Digite o código que a outra pessoa te passou.</p>
        <form class="portao-form" data-form-cofre="entrar">
          <label class="campo"><span>Código do convite</span>
            <input name="codigo" required placeholder="ex.: a1b2c3d4" autocapitalize="off" autocomplete="off" spellcheck="false"></label>
          <p class="portao-erro" hidden></p>
          <button class="botao">Entrar</button>
        </form>
        <p class="portao-troca"><button type="button" data-cofre="escolher">‹ Voltar</button></p>
      </div>`;
  }
  // escolher (padrão)
  return `
    <div class="portao-cartao">
      <span class="nome-app">Quase lá! 👋</span>
      <p class="portao-sub">Pra começar, vocês precisam de um “cofre” compartilhado.</p>
      <div class="portao-form">
        <button class="botao" data-cofre="criar">Criar o cofre do casal</button>
        <button class="botao secundario" data-cofre="entrar">Já criaram? Entrar com um código</button>
      </div>
    </div>`;
}

function mostrarOnboarding() {
  abrirGate(telaOnboarding());
}

// ---------- Mensagens de erro em português ----------

function traduzErro(msg) {
  const m = String(msg || '').toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (m.includes('already') && m.includes('register')) return 'Esse e-mail já tem conta. É só entrar.';
  if (m.includes('password')) return 'A senha precisa de pelo menos 6 letras.';
  if (m.includes('email')) return 'Confira o e-mail digitado.';
  if (m.includes('network') || m.includes('fetch')) return 'Sem conexão. Veja a internet e tente de novo.';
  return 'Não consegui agora. Tente de novo em instantes.';
}

function traduzErroCofre(msg) {
  const m = String(msg || '').toLowerCase();
  if (m.includes('convite') || m.includes('invalid')) return 'Código de convite inválido. Confira com a outra pessoa.';
  if (m.includes('network') || m.includes('fetch')) return 'Sem conexão. Veja a internet e tente de novo.';
  return 'Não consegui agora. Tente de novo em instantes.';
}

// ---------- Ações: login, cadastro, cofre, sair ----------

async function enviarPortao(form) {
  const email = form.email.value.trim();
  const senha = form.senha.value;
  const botao = form.querySelector('button');
  botao.disabled = true;
  botao.textContent = 'Um instante…';
  const { error } = modoCadastro
    ? await sb.auth.signUp({ email, password: senha })
    : await sb.auth.signInWithPassword({ email, password: senha });
  if (error) {
    mostrarErroGate(traduzErro(error.message));
    botao.disabled = false;
    botao.textContent = modoCadastro ? 'Criar conta' : 'Entrar';
  }
  // Se deu certo, o onAuthStateChange abre o app (ou o cofre) sozinho.
}

async function enviarCofre(form) {
  const tipo = form.dataset.formCofre;
  const botao = form.querySelector('button');
  botao.disabled = true;
  botao.textContent = 'Um instante…';
  try {
    if (tipo === 'criar') {
      const { data, error } = await sb.rpc('criar_casal', {
        p_nome1: form.nome1.value.trim(),
        p_nome2: form.nome2.value.trim(),
      });
      if (error) throw error;
      cofre = Array.isArray(data) ? data[0] : data;
      casalId = cofre.id;
      modoCofre = 'pronto';
      mostrarOnboarding();
    } else {
      const { error } = await sb.rpc('entrar_no_casal', { p_codigo: form.codigo.value.trim() });
      if (error) throw error;
      await resolverCofre();
      fecharGate();
      mostrarTela();
    }
  } catch (erro) {
    mostrarErroGate(traduzErroCofre(erro.message));
    botao.disabled = false;
    botao.textContent = tipo === 'criar' ? 'Criar cofre' : 'Entrar';
  }
}

async function sair() {
  casalId = null;
  cofre = null;
  modoCofre = 'escolher';
  await sb.auth.signOut();
}

// ---------- Cliques e envios ----------

document.addEventListener('click', evento => {
  const troca = evento.target.closest('[data-portao]');
  if (troca) { modoCadastro = troca.dataset.portao === 'cadastrar'; return mostrarPortao(); }

  const cof = evento.target.closest('[data-cofre]');
  if (cof) {
    const acao = cof.dataset.cofre;
    if (acao === 'abrir-app') { fecharGate(); return mostrarTela(); }
    modoCofre = acao; // criar | entrar | escolher
    return mostrarOnboarding();
  }

  if (evento.target.closest('[data-acao="sair"]')) return sair();
});

document.addEventListener('submit', evento => {
  if (evento.target.matches('[data-form-portao]')) { evento.preventDefault(); return enviarPortao(evento.target); }
  if (evento.target.matches('[data-form-cofre]')) { evento.preventDefault(); return enviarCofre(evento.target); }
});

// ---------- Ponto de partida ----------

// Descobre o cofre da pessoa logada. Devolve o casalId, ou null se ela ainda não tem cofre.
async function resolverCofre() {
  const { data, error } = await sb.from('membros').select('casal_id').limit(1);
  if (error || !data || !data.length) { casalId = null; cofre = null; return null; }
  casalId = data[0].casal_id;
  const { data: c } = await sb.from('casais').select('*').eq('id', casalId).single();
  cofre = c || null;
  return casalId;
}

function iniciarApp() {
  document.querySelector('.app').hidden = true; // evita o "pisca" do app antes de decidir
  sb.auth.onAuthStateChange((_evento, novaSessao) => {
    const estavaLogado = Boolean(sessao);
    sessao = novaSessao;
    if (!novaSessao) return mostrarPortao();
    if (!estavaLogado) aposLogin();
  });
}

// Depois de logar: tem cofre? carrega os dados e abre o app. Não tem? mostra a tela do cofre.
async function aposLogin() {
  const id = await resolverCofre();
  if (!id) { modoCofre = 'escolher'; return mostrarOnboarding(); }
  try {
    abrirGate(`<div class="portao-cartao"><span class="nome-app">Nosso Mês</span><p class="portao-sub">Carregando os dados de vocês…</p></div>`);
    await carregarDoSupabase();
  } catch (erro) {
    console.error('Erro ao carregar do Supabase:', erro);
    return abrirGate(`
      <div class="portao-cartao">
        <span class="nome-app">Ops…</span>
        <p class="portao-sub">Não consegui carregar os dados agora. Pode ser a internet.</p>
        <button class="botao" data-recarregar>Tentar de novo</button>
      </div>`);
  }
  fecharGate();
  mesVisivel = mesAtual();
  mostrarTela();
  oferecerMigracao(); // na primeira vez, oferece trazer os dados de teste do navegador
}

document.addEventListener('click', evento => {
  if (evento.target.closest('[data-recarregar]')) location.reload();
});
