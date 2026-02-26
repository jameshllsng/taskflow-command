const API_BASE =
  window.TODO_API_BASE ||
  (window.location.protocol.startsWith("http")
    ? `${window.location.origin}/api`
    : "");

const STORAGE_KEY = "tarefas";
const TOKEN_KEY = "taskflow_session_token";
const STATUS_LIST = ["nova", "andamento", "concluida", "aguardando"];
const SYNC_INTERVAL_MS = 5000;

const loginScreen = document.getElementById("login-screen");
const appShell = document.getElementById("app-shell");
const loginForm = document.getElementById("login-form");
const loginUsername = document.getElementById("login-username");
const loginPassword = document.getElementById("login-password");
const avisoLogin = document.getElementById("aviso-login");
const usuarioLogadoLabel = document.getElementById("usuario-logado");
const btnLogout = document.getElementById("btn-logout");
const btnHome = document.getElementById("btn-home");
const btnUsuarios = document.getElementById("btn-usuarios");
const btnAdminChamados = document.getElementById("btn-admin-chamados");
const viewTarefas = document.getElementById("view-tarefas");
const viewUsuarios = document.getElementById("view-usuarios");
const viewAdminChamados = document.getElementById("view-admin-chamados");

const inputTarefa = document.getElementById("tarefa");
const inputDescricaoTarefa = document.getElementById("descricao-tarefa");
const selectStatus = document.getElementById("status");
const selectAtribuidaPara = document.getElementById("atribuida-para");
const inputPrazo = document.getElementById("prazo");
const btnAdicionar = document.getElementById("adicionar");
const listaTarefas = document.getElementById("tarefas");
const containerFiltros = document.querySelector(".filtros");
const aviso = document.getElementById("aviso");

const painelUsuarios = document.getElementById("painel-usuarios");
const formUsuario = document.getElementById("form-usuario");
const campoUsuarioId = document.getElementById("usuario-id");
const campoUsuarioNome = document.getElementById("usuario-nome");
const campoUsuarioSenha = document.getElementById("usuario-senha");
const campoUsuarioPapel = document.getElementById("usuario-papel");
const btnCancelarEdicaoUsuario = document.getElementById("btn-cancelar-edicao-usuario");
const listaUsuarios = document.getElementById("lista-usuarios");
const avisoUsuarios = document.getElementById("aviso-usuarios");
const listaChamadosAdmin = document.getElementById("lista-chamados-admin");
const avisoAdminChamados = document.getElementById("aviso-admin-chamados");
const selectAllChamados = document.getElementById("select-all-chamados");
const btnExcluirSelecionados = document.getElementById("btn-excluir-selecionados");
const contadorSelecionados = document.getElementById("contador-selecionados");
const popupNotificacao = document.getElementById("popup-notificacao");
const popupNotificacaoTexto = document.getElementById("popup-notificacao-texto");
const popupOverlay = document.getElementById("popup-overlay");

let tarefas = [];
let statusFiltro = "todas";
let editandoId = null;
let audioContext = null;
let avisoTimeout = null;
let avisoUsuariosTimeout = null;
let authToken = localStorage.getItem(TOKEN_KEY) || "";
let usuarioAtual = null;
let logoutTimerId = null;
let syncIntervalId = null;
let prazoIntervalId = null;
let usuarioEditandoId = null;
let currentView = "tarefas";
let usuariosAtribuicao = [];
let popupTimeout = null;
let audioUnlocked = false;

function escaparHtml(texto) {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function mostrarAvisoLogin(mensagem) {
  avisoLogin.textContent = mensagem;
  avisoLogin.classList.remove("d-none");
}

function limparAvisoLogin() {
  avisoLogin.textContent = "";
  avisoLogin.classList.add("d-none");
}

function mostrarAviso(mensagem) {
  if (!aviso) return;
  aviso.textContent = mensagem;
  aviso.classList.remove("d-none");
  clearTimeout(avisoTimeout);
  avisoTimeout = setTimeout(() => {
    aviso.classList.add("d-none");
  }, 2500);
}

function esconderAviso() {
  if (!aviso) return;
  aviso.classList.add("d-none");
}

function mostrarAvisoUsuarios(mensagem, tipo = "warning") {
  if (!avisoUsuarios) return;
  avisoUsuarios.className = `alert alert-${tipo} py-2 mb-3`;
  avisoUsuarios.textContent = mensagem;
  avisoUsuarios.classList.remove("d-none");
  clearTimeout(avisoUsuariosTimeout);
  avisoUsuariosTimeout = setTimeout(() => {
    avisoUsuarios.classList.add("d-none");
  }, 3000);
}

function mostrarAvisoAdminChamados(mensagem, tipo = "warning") {
  if (!avisoAdminChamados) return;
  avisoAdminChamados.className = `alert alert-${tipo} py-2 mb-3`;
  avisoAdminChamados.textContent = mensagem;
  avisoAdminChamados.classList.remove("d-none");
  setTimeout(() => {
    avisoAdminChamados.classList.add("d-none");
  }, 2800);
}

function tocarSomNotificacao() {
  if (!audioUnlocked) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  if (!audioContext) {
    audioContext = new AudioCtx();
  }

  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }

  const ctx = audioContext;
  const t0 = ctx.currentTime;
  const duracao = 3.8;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(0.95, t0 + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + duracao);
  master.connect(ctx.destination);

  const criarParcial = (freq, tipo, inicio, fim, ganhoInicial) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, t0 + inicio);
    gain.gain.setValueAtTime(0.0001, t0 + inicio);
    gain.gain.exponentialRampToValueAtTime(ganhoInicial, t0 + inicio + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + fim);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0 + inicio);
    osc.stop(t0 + fim);
  };

  // Parciais inarmônicas para timbre de metal
  criarParcial(930, "sine", 0, duracao, 0.9);
  criarParcial(1420, "triangle", 0.01, duracao - 0.2, 0.45);
  criarParcial(2310, "sine", 0.015, duracao - 0.35, 0.3);
  criarParcial(3180, "triangle", 0.02, duracao - 0.6, 0.22);
  criarParcial(4120, "sine", 0.03, duracao - 0.9, 0.16);
}

function mostrarPopupNotificacao(mensagem) {
  if (!popupNotificacao || !popupNotificacaoTexto) return;
  popupNotificacaoTexto.textContent = mensagem;
  popupNotificacao.style.top = "50%";
  popupNotificacao.style.left = "50%";
  popupNotificacao.style.right = "auto";
  popupNotificacao.style.bottom = "auto";
  popupNotificacao.style.transform = "translate(-50%, -50%)";
  popupNotificacao.style.width = "min(680px, 92vw)";
  popupOverlay?.classList.remove("d-none");
  popupNotificacao.classList.remove("d-none");
  clearTimeout(popupTimeout);
  popupTimeout = setTimeout(() => {
    popupNotificacao.classList.add("d-none");
    popupOverlay?.classList.add("d-none");
  }, 8000);
}

function unlockAudioOnce() {
  if (audioUnlocked) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!audioContext) {
    audioContext = new AudioCtx();
  }

  const resume = async () => {
    try {
      await audioContext.resume();
      audioUnlocked = true;
      document.removeEventListener("pointerdown", resume);
      document.removeEventListener("keydown", resume);
      document.removeEventListener("touchstart", resume);
    } catch {
      // tenta novamente no próximo gesto
    }
  };

  document.addEventListener("pointerdown", resume);
  document.addEventListener("keydown", resume);
  document.addEventListener("touchstart", resume);
}

function atualizarBotoesTopo() {
  const botoes = [btnHome, btnUsuarios, btnAdminChamados];
  botoes.forEach((btn) => btn?.classList.remove("top-nav-active"));

  if (currentView === "tarefas") btnHome?.classList.add("top-nav-active");
  if (currentView === "usuarios") btnUsuarios?.classList.add("top-nav-active");
  if (currentView === "admin-chamados") btnAdminChamados?.classList.add("top-nav-active");
}

function abrirView(view) {
  currentView = view;

  viewTarefas.classList.toggle("d-none", view !== "tarefas");
  viewUsuarios.classList.toggle("d-none", view !== "usuarios");
  viewAdminChamados.classList.toggle("d-none", view !== "admin-chamados");

  btnHome.classList.toggle("d-none", view === "tarefas");
  atualizarBotoesTopo();
}

function authHeaders(contentType = true) {
  const headers = {};
  if (contentType) headers["Content-Type"] = "application/json";
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  return headers;
}

function nomeUsuarioPorId(userId, fallback = "") {
  if (!userId) return "Sem atribuição";
  const user = usuariosAtribuicao.find((u) => u.id === userId);
  return user?.username || fallback || "Usuário removido";
}

function renderSelectAtribuicao() {
  if (!selectAtribuidaPara) return;

  const atual = selectAtribuidaPara.value;
  const opcoes = ['<option value="">Sem atribuição</option>']
    .concat(
      usuariosAtribuicao.map(
        (u) => `<option value="${escaparHtml(u.id)}">${escaparHtml(u.username)}</option>`,
      ),
    )
    .join("");

  selectAtribuidaPara.innerHTML = opcoes;
  if ([...selectAtribuidaPara.options].some((opt) => opt.value === atual)) {
    selectAtribuidaPara.value = atual;
  }
}

async function carregarUsuariosParaAtribuicao() {
  const response = await apiFetch("/users/options", {
    method: "GET",
    headers: authHeaders(false),
  });

  if (!response.ok) return;
  const users = await response.json();
  usuariosAtribuicao = Array.isArray(users) ? users : [];
  renderSelectAtribuicao();
}

function mostrarTelaLogin() {
  loginScreen.classList.remove("d-none");
  appShell.classList.add("d-none");
}

function mostrarApp() {
  loginScreen.classList.add("d-none");
  appShell.classList.remove("d-none");
}

function limparSessaoLocal() {
  authToken = "";
  usuarioAtual = null;
  localStorage.removeItem(TOKEN_KEY);
  clearTimeout(logoutTimerId);
  clearInterval(syncIntervalId);
  clearInterval(prazoIntervalId);
  syncIntervalId = null;
  prazoIntervalId = null;
  currentView = "tarefas";
  clearTimeout(popupTimeout);
  popupNotificacao?.classList.add("d-none");
  popupOverlay?.classList.add("d-none");
}

function agendarLogout(expiresAt) {
  clearTimeout(logoutTimerId);
  const msRestante = Number(expiresAt) - Date.now();

  if (msRestante <= 0) {
    void forcarLogout("Sua sessão expirou. Faça login novamente.");
    return;
  }

  logoutTimerId = setTimeout(() => {
    void forcarLogout("Sessão encerrada automaticamente após 6 horas.");
  }, msRestante);
}

function atualizarCabecalhoUsuario() {
  if (!usuarioAtual) {
    usuarioLogadoLabel.textContent = "";
    btnHome.classList.add("d-none");
    btnUsuarios.classList.add("d-none");
    btnAdminChamados.classList.add("d-none");
    return;
  }

  const tipo = usuarioAtual.role === "admin" ? "Admin" : "Usuário";
  usuarioLogadoLabel.textContent = `${usuarioAtual.username} (${tipo})`;

  if (usuarioAtual.role === "admin") {
    btnUsuarios.classList.remove("d-none");
    btnAdminChamados.classList.remove("d-none");
  } else {
    btnUsuarios.classList.add("d-none");
    btnAdminChamados.classList.add("d-none");
    if (currentView !== "tarefas") {
      abrirView("tarefas");
    }
  }
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);

  if (response.status === 401) {
    await forcarLogout("Sua sessão expirou. Faça login novamente.");
    throw new Error("Sessão expirada");
  }

  return response;
}

async function autenticarSessaoAtual() {
  if (!authToken) return false;

  try {
    const response = await fetch(`${API_BASE}/auth/session`, {
      method: "GET",
      headers: authHeaders(false),
    });

    if (!response.ok) {
      limparSessaoLocal();
      return false;
    }

    const data = await response.json();
    usuarioAtual = data.user;
    atualizarCabecalhoUsuario();
    agendarLogout(data.expiresAt);
    return true;
  } catch {
    limparSessaoLocal();
    return false;
  }
}

async function forcarLogout(mensagem = "") {
  try {
    if (authToken) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: authHeaders(true),
      });
    }
  } catch {
    // ignora falha de logout remoto
  }

  limparSessaoLocal();
  mostrarTelaLogin();
  if (mensagem) mostrarAvisoLogin(mensagem);
}

function initAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (AudioCtx && !audioContext) {
    audioContext = new AudioCtx();
  }
  unlockAudioOnce();
}

async function initNotificacoes() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

function deveNotificar(tarefa) {
  if (!tarefa.prazo || tarefa.status === "concluida") return false;

  const agora = new Date();
  const prazo = new Date(tarefa.prazo);
  const diffMs = prazo - agora;
  const diffDias = diffMs / (1000 * 60 * 60 * 24);
  const diffHoras = diffMs / (1000 * 60 * 60);

  const noDia = diffDias <= 1 && diffDias > 0 && diffHoras % 1 < 0.04;
  const antes = diffDias <= 2 && diffDias > 1 && diffHoras % 6 < 0.04;

  return noDia || antes;
}

function notificarTarefa(tarefa) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const prazo = new Date(tarefa.prazo);
  new Notification("⏰ PRAZO PROXIMO!", {
    body: `${tarefa.texto} - ${prazo.toLocaleDateString("pt-BR")} ${prazo.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    tag: `tarefa-${tarefa.id || tarefa.criada}`,
  });

  tocarSomNotificacao();
}

function verificarPrazos() {
  tarefas.forEach((tarefa) => {
    if (deveNotificar(tarefa)) {
      notificarTarefa(tarefa);
    }
  });
}

function formatarData(timestamp) {
  return new Date(timestamp).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function calcularTempoGasto(criada, concluida) {
  const diff = concluida - criada;
  const horas = Math.floor(diff / 3600000);
  const minutos = Math.floor((diff % 3600000) / 60000);
  return horas > 0 ? `${horas}h ${minutos}m` : `${minutos}min`;
}

function obterPrazoPadrao() {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  amanha.setMinutes(0, 0, 0);
  return amanha.toISOString().slice(0, 16);
}

function definirPrazoPadrao() {
  inputPrazo.value = obterPrazoPadrao();
}

function avancarStatus(statusAtual) {
  const indiceAtual = STATUS_LIST.indexOf(statusAtual);
  return STATUS_LIST[(indiceAtual + 1) % STATUS_LIST.length];
}

function limparModoEdicao() {
  editandoId = null;
  inputTarefa.value = "";
  inputDescricaoTarefa.value = "";
  inputPrazo.value = "";
  selectAtribuidaPara.value = "";
  inputTarefa.placeholder = "Descreva a tarefa...";
  btnAdicionar.innerHTML = '<i class="bi bi-plus-lg"></i> Adicionar';
}

function renderEstadoVazio() {
  listaTarefas.innerHTML = `
    <li class="todo-item list-group-item p-4 text-center">
      <div class="meta-text">Nenhuma tarefa encontrada para este filtro.</div>
    </li>
  `;
}

function renderTarefas() {
  listaTarefas.innerHTML = "";
  const tarefasFiltradas = tarefas
    .map((tarefa, indiceReal) => ({ tarefa, indiceReal }))
    .filter(({ tarefa }) => statusFiltro === "todas" || tarefa.status === statusFiltro);

  if (tarefasFiltradas.length === 0) {
    renderEstadoVazio();
    renderChamadosAdmin();
    return;
  }

  tarefasFiltradas.forEach(({ tarefa, indiceReal }) => {
    const li = document.createElement("li");
    li.className = `todo-item list-group-item p-3 mb-3 ${tarefa.status}`;

    let metaHtml = `<small><i class="bi bi-calendar-event me-1"></i>${formatarData(tarefa.criada)}</small>`;

    if (tarefa.prazo) {
      const prazoData = new Date(tarefa.prazo);
      const diffDias = (prazoData - new Date()) / (1000 * 60 * 60 * 24);
      let prazoClasse = "";
      if (diffDias <= 1) prazoClasse = "text-danger fw-bold";
      else if (diffDias <= 2) prazoClasse = "text-warning";

      metaHtml += `<br><small class="${prazoClasse}"><i class="bi bi-clock-history me-1"></i>Prazo: ${prazoData.toLocaleDateString("pt-BR")} ${prazoData.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small>`;
    }

    if (tarefa.status === "concluida" && tarefa.concluida) {
      const tempoGasto = calcularTempoGasto(tarefa.criada, tarefa.concluida);
      metaHtml += `<br><small class="text-success"><i class="bi bi-check-circle-fill me-1"></i>Concluída: ${formatarData(tarefa.concluida)}</small>`;
      metaHtml += `<br><small class="text-warning"><i class="bi bi-stopwatch-fill me-1"></i>${tempoGasto}</small>`;
    }

    const abertaPor = escaparHtml(tarefa.abertaPorNome || "Sistema");
    const atribuidaPara = escaparHtml(
      nomeUsuarioPorId(tarefa.atribuidaParaId, tarefa.atribuidaParaNome || ""),
    );
    const descricao = (tarefa.descricao || "").trim();
    metaHtml += `<br><small><i class="bi bi-person-plus me-1"></i>Aberta por: ${abertaPor}</small>`;
    metaHtml += `<br><small><i class="bi bi-person-check me-1"></i>Atribuída para: ${atribuidaPara}</small>`;
    if (descricao) {
      metaHtml += `<br><small class="descricao-tarefa"><i class="bi bi-card-text me-1"></i>${escaparHtml(descricao)}</small>`;
    }

    li.innerHTML = `
      <div class="flex-grow-1">
        <div class="texto fw-semibold mb-1" style="cursor:pointer;${window.innerWidth <= 768 ? "user-select:none;" : ""}" ${window.innerWidth <= 768 ? `ontouchstart="editarStatusMobile(${indiceReal})"` : `ondblclick="editar(${indiceReal})"`}>
          ${escaparHtml(tarefa.texto)}
        </div>
        <div class="meta-text">${metaHtml}</div>
      </div>
      <div class="acoes d-flex gap-2">
        <button class="btn btn-noir-edit btn-sm" onclick="editar(${indiceReal})" title="Editar tarefa"><i class="bi bi-pencil"></i></button>
        <button class="btn status-btn btn-sm" onclick="mudarStatus(${indiceReal})" title="Avançar status"><i class="bi bi-arrow-right-circle"></i> <span class="status-text">${tarefa.status.charAt(0).toUpperCase() + tarefa.status.slice(1)}</span></button>
        <button class="btn-excluir btn btn-danger btn-sm" onclick="excluir(${indiceReal})" title="Excluir"><i class="bi bi-trash"></i></button>
      </div>
    `;

    listaTarefas.appendChild(li);
  });

  renderChamadosAdmin();
}

function totalSelecionadosChamadosAdmin() {
  return listaChamadosAdmin.querySelectorAll('input[data-chamado]:checked').length;
}

function atualizarControleChamadosAdmin() {
  const checkboxes = listaChamadosAdmin.querySelectorAll('input[data-chamado]');
  const selecionados = totalSelecionadosChamadosAdmin();
  contadorSelecionados.textContent = `${selecionados} selecionado(s)`;

  if (!checkboxes.length) {
    selectAllChamados.checked = false;
    btnExcluirSelecionados.disabled = true;
    return;
  }

  selectAllChamados.checked = selecionados > 0 && selecionados === checkboxes.length;
  btnExcluirSelecionados.disabled = selecionados === 0;
}

function renderChamadosAdmin() {
  if (!listaChamadosAdmin) return;

  if (!tarefas.length) {
    listaChamadosAdmin.innerHTML = '<div class="col-12"><div class="chamado-card-compacto">Nenhum chamado disponível.</div></div>';
    atualizarControleChamadosAdmin();
    return;
  }

  listaChamadosAdmin.innerHTML = tarefas
    .map((tarefa, indice) => {
      const id = chaveTarefa(tarefa, indice);
      return `
        <div class="col-xl-3 col-lg-4 col-md-6 col-12">
          <label class="chamado-card-compacto d-block ${tarefa.status}">
            <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
              <input type="checkbox" data-chamado="${escaparHtml(id)}">
              <span class="badge text-bg-dark">${escaparHtml(tarefa.status)}</span>
            </div>
            <div class="titulo fw-semibold mb-1">${escaparHtml(tarefa.texto)}</div>
            ${
              (tarefa.descricao || "").trim()
                ? `<div class="meta mb-1">${escaparHtml(String(tarefa.descricao).slice(0, 120))}</div>`
                : ""
            }
            <div class="meta">Criado: ${formatarData(tarefa.criada)}</div>
            <div class="meta">Aberta por: ${escaparHtml(tarefa.abertaPorNome || "Sistema")}</div>
            <div class="meta">Atribuída: ${escaparHtml(
              nomeUsuarioPorId(tarefa.atribuidaParaId, tarefa.atribuidaParaNome || ""),
            )}</div>
          </label>
        </div>
      `;
    })
    .join("");

  atualizarControleChamadosAdmin();
}

function prazoValido(prazoTexto) {
  return new Date(prazoTexto).getTime() > Date.now();
}

function obterPrazoFinal() {
  return inputPrazo.value || obterPrazoPadrao();
}

async function adicionarTarefa() {
  const texto = inputTarefa.value.trim();
  const descricao = inputDescricaoTarefa.value.trim();
  if (!texto) {
    mostrarAviso("Digite um nome para a tarefa antes de adicionar.");
    inputTarefa.focus();
    return;
  }
  esconderAviso();

  const prazoFinal = obterPrazoFinal();
  if (!prazoValido(prazoFinal)) {
    mostrarAviso("O prazo deve ser uma data futura.");
    inputPrazo.focus();
    return;
  }

  if (editandoId !== null) {
    const tarefaAtual = tarefas[editandoId];
    const statusAnterior = tarefaAtual.status;

    tarefaAtual.texto = texto;
    tarefaAtual.descricao = descricao;
    tarefaAtual.status = selectStatus.value;
    tarefaAtual.prazo = prazoFinal;
    tarefaAtual.atribuidaParaId = selectAtribuidaPara.value || null;
    tarefaAtual.atribuidaParaNome = nomeUsuarioPorId(selectAtribuidaPara.value || null, "");

    if (tarefaAtual.status === "concluida" && !tarefaAtual.concluida) {
      tarefaAtual.concluida = Date.now();
    } else if (statusAnterior === "concluida" && tarefaAtual.status !== "concluida") {
      tarefaAtual.concluida = null;
    }

    limparModoEdicao();
  } else {
    tarefas.push({
      id: Date.now(),
      texto,
      descricao,
      status: selectStatus.value,
      criada: Date.now(),
      prazo: prazoFinal,
      abertaPorId: usuarioAtual?.id || null,
      abertaPorNome: usuarioAtual?.username || "Sistema",
      atribuidaParaId: selectAtribuidaPara.value || null,
      atribuidaParaNome: nomeUsuarioPorId(selectAtribuidaPara.value || null, ""),
      concluida: selectStatus.value === "concluida" ? Date.now() : null,
    });

    selectStatus.value = "nova";
    selectAtribuidaPara.value = "";
    inputDescricaoTarefa.value = "";
    inputPrazo.value = "";
    inputTarefa.value = "";
  }

  await salvar();
  renderTarefas();
}

function editarStatusMobile(id) {
  if (window.innerWidth > 768) return;

  const statusAtual = tarefas[id].status;
  const novoStatus = avancarStatus(statusAtual);
  tarefas[id].status = novoStatus;

  if (novoStatus === "concluida" && !tarefas[id].concluida) {
    tarefas[id].concluida = Date.now();
  } else if (statusAtual === "concluida" && novoStatus !== "concluida") {
    tarefas[id].concluida = null;
  }

  void salvar();
  renderTarefas();
}

function editar(id) {
  editandoId = id;
  inputTarefa.value = tarefas[id].texto;
  inputDescricaoTarefa.value = tarefas[id].descricao || "";
  selectStatus.value = tarefas[id].status;
  selectAtribuidaPara.value = tarefas[id].atribuidaParaId || "";
  inputPrazo.value = tarefas[id].prazo ? tarefas[id].prazo.slice(0, 16) : "";
  inputTarefa.placeholder = "Edite a tarefa... (Enter salva | Esc cancela)";
  btnAdicionar.innerHTML = '<i class="bi bi-check-lg"></i> Salvar';
  inputTarefa.focus();
}

function mudarStatus(id) {
  const statusAtual = tarefas[id].status;
  const novoStatus = avancarStatus(statusAtual);

  tarefas[id].status = novoStatus;

  if (novoStatus === "concluida" && !tarefas[id].concluida) {
    tarefas[id].concluida = Date.now();
  } else if (statusAtual === "concluida" && novoStatus !== "concluida") {
    tarefas[id].concluida = null;
  }

  void salvar();
  renderTarefas();
}

function excluir(id) {
  if (!confirm("Excluir esta tarefa permanentemente?")) return;

  tarefas.splice(id, 1);

  if (editandoId === id) {
    limparModoEdicao();
  } else if (editandoId !== null && id < editandoId) {
    editandoId -= 1;
  }

  void salvar();
  renderTarefas();
}

async function excluirChamadosSelecionadosAdmin() {
  const selecionados = new Set(
    [...listaChamadosAdmin.querySelectorAll('input[data-chamado]:checked')].map((input) => input.dataset.chamado),
  );

  if (!selecionados.size) {
    mostrarAvisoAdminChamados("Selecione pelo menos um chamado.", "warning");
    return;
  }

  if (!confirm(`Excluir ${selecionados.size} chamado(s) selecionado(s)?`)) {
    return;
  }

  tarefas = tarefas.filter((tarefa, indice) => !selecionados.has(chaveTarefa(tarefa, indice)));
  await salvar();
  renderTarefas();
  mostrarAvisoAdminChamados("Chamados selecionados excluídos com sucesso.", "success");
}

async function carregarDoBackend() {
  const response = await apiFetch("/tarefas", {
    method: "GET",
    headers: authHeaders(false),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function salvarNoBackend(snapshot) {
  const response = await apiFetch("/tarefas", {
    method: "PUT",
    headers: authHeaders(true),
    body: JSON.stringify(snapshot),
  });

  return response.ok;
}

async function carregar() {
  const backend = await carregarDoBackend();
  tarefas = backend || [];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tarefas));
}

async function salvar() {
  const snapshot = [...tarefas];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  await salvarNoBackend(snapshot);
}

function chaveTarefa(tarefa, indice) {
  return String(tarefa.id ?? `${tarefa.criada ?? "sem-criada"}-${indice}`);
}

async function sincronizarComBackend() {
  const backend = await carregarDoBackend();
  if (!backend) return;

  const remoto = JSON.stringify(backend);
  const atual = JSON.stringify(tarefas);
  if (remoto === atual) return;

  if (editandoId !== null) {
    mostrarAviso("A lista foi alterada. Salve/cancele a edição para atualizar.");
    return;
  }

  const mapaAtual = new Map(tarefas.map((t, i) => [chaveTarefa(t, i), t]));
  const mapaRemoto = new Map(backend.map((t, i) => [chaveTarefa(t, i), t]));

  let adicionadas = 0;
  let removidas = 0;
  let atualizadas = 0;

  for (const id of mapaRemoto.keys()) if (!mapaAtual.has(id)) adicionadas += 1;
  for (const id of mapaAtual.keys()) if (!mapaRemoto.has(id)) removidas += 1;

  for (const [id, tarefaRemota] of mapaRemoto.entries()) {
    const tarefaAtual = mapaAtual.get(id);
    if (!tarefaAtual) continue;
    if (JSON.stringify(tarefaAtual) !== JSON.stringify(tarefaRemota)) atualizadas += 1;
  }

  if (usuarioAtual?.role === "user") {
    let novasCriadas = 0;
    let novasAtribuidasParaMim = 0;

    for (const [id, tarefaRemota] of mapaRemoto.entries()) {
      const tarefaAtual = mapaAtual.get(id);
      const ehNova = !tarefaAtual;
      const atribuidaAgoraParaMim = tarefaRemota.atribuidaParaId === usuarioAtual.id;
      const atribuidaAntesParaMim = tarefaAtual?.atribuidaParaId === usuarioAtual.id;

      if (ehNova) novasCriadas += 1;
      if (atribuidaAgoraParaMim && !atribuidaAntesParaMim) {
        novasAtribuidasParaMim += 1;
      }
    }

    const partes = [];
    if (novasCriadas > 0) {
      partes.push(`${novasCriadas} nova(s) tarefa(s) criada(s).`);
    }
    if (novasAtribuidasParaMim > 0) {
      partes.push(`${novasAtribuidasParaMim} nova(s) tarefa(s) atribuída(s) para você.`);
    }
    if (partes.length > 0) {
      mostrarPopupNotificacao(partes.join(" "));
      tocarSomNotificacao();
    }
  }

  let mensagem = "Lista sincronizada.";
  if (adicionadas > 0 && removidas === 0 && atualizadas === 0) {
    mensagem = "Nova(s) tarefa(s) adicionada(s) por outro usuário.";
  } else if (removidas > 0 && adicionadas === 0 && atualizadas === 0) {
    mensagem = "Tarefa(s) foram removida(s) por outro usuário.";
  } else if (atualizadas > 0 && adicionadas === 0 && removidas === 0) {
    mensagem = "Tarefa(s) foram atualizada(s) por outro usuário.";
  } else {
    mensagem = "A lista foi sincronizada com múltiplas alterações.";
  }

  tarefas = backend;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tarefas));
  renderTarefas();
  mostrarAviso(mensagem);
}

function limparFormularioUsuario() {
  usuarioEditandoId = null;
  campoUsuarioId.value = "";
  campoUsuarioNome.value = "";
  campoUsuarioSenha.value = "";
  campoUsuarioPapel.value = "user";
  btnCancelarEdicaoUsuario.classList.add("d-none");
}

function renderUsuarios(users) {
  if (!users.length) {
    listaUsuarios.innerHTML = '<li class="usuario-item">Nenhum usuário cadastrado.</li>';
    return;
  }

  listaUsuarios.innerHTML = users
    .map(
      (user) => `
      <li class="usuario-item d-flex justify-content-between align-items-center flex-wrap gap-2" data-id="${user.id}">
        <div>
          <div class="fw-semibold">${escaparHtml(user.username)} <span class="badge ${user.role === "admin" ? "text-bg-danger" : "text-bg-secondary"}">${user.role}</span></div>
          <div class="usuario-meta">Criado em ${formatarData(user.createdAt)}</div>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-noir-edit btn-sm" data-action="editar">Editar</button>
          <button class="btn btn-danger btn-sm" data-action="excluir">Excluir</button>
        </div>
      </li>
    `,
    )
    .join("");
}

async function carregarUsuarios() {
  if (usuarioAtual?.role !== "admin") return;

  const response = await apiFetch("/users", {
    method: "GET",
    headers: authHeaders(false),
  });

  if (!response.ok) {
    mostrarAvisoUsuarios("Não foi possível carregar usuários.", "danger");
    return;
  }

  const users = await response.json();
  renderUsuarios(users);
  await carregarUsuariosParaAtribuicao();
  renderTarefas();
}

async function salvarUsuario(event) {
  event.preventDefault();

  const username = campoUsuarioNome.value.trim();
  const password = campoUsuarioSenha.value;
  const role = campoUsuarioPapel.value === "admin" ? "admin" : "user";

  if (username.length < 3) {
    mostrarAvisoUsuarios("Usuário deve ter ao menos 3 caracteres.", "danger");
    return;
  }

  if (!usuarioEditandoId && password.length < 3) {
    mostrarAvisoUsuarios("Senha deve ter ao menos 3 caracteres.", "danger");
    return;
  }

  const payload = { username, role };
  if (password) payload.password = password;

  const endpoint = usuarioEditandoId ? `/users/${usuarioEditandoId}` : "/users";
  const method = usuarioEditandoId ? "PUT" : "POST";

  const response = await apiFetch(endpoint, {
    method,
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Falha ao salvar usuário." }));
    mostrarAvisoUsuarios(error.error || "Falha ao salvar usuário.", "danger");
    return;
  }

  limparFormularioUsuario();
  await carregarUsuarios();
  await carregarUsuariosParaAtribuicao();
  renderTarefas();
  mostrarAvisoUsuarios("Usuário salvo com sucesso.", "success");
}

async function excluirUsuario(userId) {
  if (!confirm("Deseja excluir este usuário?")) return;

  const response = await apiFetch(`/users/${userId}`, {
    method: "DELETE",
    headers: authHeaders(true),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Falha ao excluir usuário." }));
    mostrarAvisoUsuarios(error.error || "Falha ao excluir usuário.", "danger");
    return;
  }

  await carregarUsuarios();
  await carregarUsuariosParaAtribuicao();
  renderTarefas();
  mostrarAvisoUsuarios("Usuário excluído com sucesso.", "success");
}

async function prepararEdicaoUsuario(userId) {
  const response = await apiFetch("/users", {
    method: "GET",
    headers: authHeaders(false),
  });

  if (!response.ok) {
    mostrarAvisoUsuarios("Não foi possível carregar dados do usuário.", "danger");
    return;
  }

  const users = await response.json();
  const user = users.find((u) => u.id === userId);
  if (!user) return;

  usuarioEditandoId = user.id;
  campoUsuarioId.value = user.id;
  campoUsuarioNome.value = user.username;
  campoUsuarioSenha.value = "";
  campoUsuarioPapel.value = user.role;
  btnCancelarEdicaoUsuario.classList.remove("d-none");
}

function iniciarSincronizacao() {
  clearInterval(syncIntervalId);
  clearInterval(prazoIntervalId);

  syncIntervalId = setInterval(() => {
    void sincronizarComBackend();
  }, SYNC_INTERVAL_MS);

  prazoIntervalId = setInterval(verificarPrazos, 3600000);
}

async function iniciarAppPosLogin() {
  mostrarApp();
  abrirView("tarefas");
  atualizarCabecalhoUsuario();
  limparAvisoLogin();
  definirPrazoPadrao();
  await carregarUsuariosParaAtribuicao();
  await carregar();
  renderTarefas();

  if (usuarioAtual?.role === "admin") {
    await carregarUsuarios();
  }

  iniciarSincronizacao();
  verificarPrazos();
  void sincronizarComBackend();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  limparAvisoLogin();

  const username = loginUsername.value.trim();
  const password = loginPassword.value;

  if (!username || !password) {
    mostrarAvisoLogin("Preencha usuário e senha.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Falha no login." }));
      mostrarAvisoLogin(error.error || "Falha no login.");
      return;
    }

    const data = await response.json();
    authToken = data.token;
    usuarioAtual = data.user;
    localStorage.setItem(TOKEN_KEY, authToken);
    agendarLogout(data.expiresAt);

    loginPassword.value = "";
    await iniciarAppPosLogin();
  } catch {
    mostrarAvisoLogin("Não foi possível conectar ao servidor.");
  }
});

btnLogout.addEventListener("click", async () => {
  await forcarLogout("Você saiu da sessão.");
});

btnUsuarios.addEventListener("click", async () => {
  if (usuarioAtual?.role !== "admin") return;
  abrirView("usuarios");
  await carregarUsuarios();
});

btnHome.addEventListener("click", () => {
  abrirView("tarefas");
});

btnAdminChamados.addEventListener("click", () => {
  if (usuarioAtual?.role !== "admin") return;
  abrirView("admin-chamados");
  renderChamadosAdmin();
});

formUsuario.addEventListener("submit", (event) => {
  void salvarUsuario(event);
});

btnCancelarEdicaoUsuario.addEventListener("click", () => {
  limparFormularioUsuario();
});

listaUsuarios.addEventListener("click", (event) => {
  const botao = event.target.closest("button[data-action]");
  if (!botao) return;

  const item = botao.closest("li[data-id]");
  if (!item) return;

  const userId = item.dataset.id;
  const action = botao.dataset.action;

  if (action === "editar") {
    void prepararEdicaoUsuario(userId);
  } else if (action === "excluir") {
    void excluirUsuario(userId);
  }
});

selectAllChamados.addEventListener("change", () => {
  const marcado = selectAllChamados.checked;
  listaChamadosAdmin.querySelectorAll('input[data-chamado]').forEach((input) => {
    input.checked = marcado;
  });
  atualizarControleChamadosAdmin();
});

listaChamadosAdmin.addEventListener("change", (event) => {
  if (!event.target.matches('input[data-chamado]')) return;
  atualizarControleChamadosAdmin();
});

btnExcluirSelecionados.addEventListener("click", () => {
  if (usuarioAtual?.role !== "admin") return;
  void excluirChamadosSelecionadosAdmin();
});

containerFiltros.addEventListener("click", (event) => {
  const btnFiltro = event.target.closest(".filtro");
  if (!btnFiltro) return;

  document.querySelectorAll(".filtro").forEach((f) => {
    f.classList.remove("active", "btn-noir-primary");
  });

  btnFiltro.classList.add("active", "btn-noir-primary");
  statusFiltro = btnFiltro.dataset.status;
  renderTarefas();
});

btnAdicionar.addEventListener("click", () => {
  void adicionarTarefa();
});

inputTarefa.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void adicionarTarefa();
  }

  if (event.key === "Escape" && editandoId !== null) {
    limparModoEdicao();
  }
});

window.addEventListener("resize", renderTarefas);

window.addEventListener("load", async () => {
  initAudio();
  await initNotificacoes();

  if (!API_BASE) {
    mostrarTelaLogin();
    mostrarAvisoLogin("Abra o sistema pelo servidor para usar login e usuários.");
    return;
  }

  const ok = await autenticarSessaoAtual();
  if (!ok) {
    mostrarTelaLogin();
    return;
  }

  await iniciarAppPosLogin();
});

window.editar = editar;
window.mudarStatus = mudarStatus;
window.excluir = excluir;
window.editarStatusMobile = editarStatusMobile;
