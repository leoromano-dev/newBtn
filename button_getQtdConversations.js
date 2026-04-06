const btnVerConversas = document.getElementById("verConversasBtn");
const inputData = document.getElementById("inputData");
const infoDiv = document.getElementById("finalizadasInfo");
const btnIncrease = document.getElementById("increaseLimitBtn");
const banner = document.getElementById("limitBanner");

// variáveis globais preenchidas pelo Meteor
let agentData = null;

// Preenche input com data de hoje
(function setHoje() {
  const hoje = new Date();
  inputData.value = hoje.toISOString().split("T")[0];
})();

// função de fetch com autenticação dinâmica
async function fetchWithAuth(url, options = {}) {
  if (!agentData) throw new Error("Dados do agente não recebidos ainda!");
  options.headers = {
    ...options.headers,
    "X-Auth-Token": agentData.token,
    "X-User-Id": agentData.userId
  };
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`Erro na requisição: ${res.status}`);
  return res.json();
}

// busca usuário pelo username
async function getUserByUsername(username) {
  const data = await fetchWithAuth(`${agentData.siteUrl}/users.info?username=${encodeURIComponent(username)}`);
  if (!data.user) throw new Error("Usuário não encontrado");
  return data.user;
}

// busca chats do agente por data (separando finalizadas e abertas)
async function getChatsByDate(agentId, targetDate) {
  let closed = 0, open = 0, offset = 0;

  // intervalo de data (início e fim do dia)
  const start = new Date(targetDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(targetDate);
  end.setUTCHours(23, 59, 59, 999);

  // ---- Finalizadas (usar closedAt) ----
  offset = 0;
  while (true) {
    const url = `${agentData.siteUrl}/livechat/rooms?agents[]=${agentId}&offset=${offset}&closedAt=${encodeURIComponent(JSON.stringify({ start: start.toISOString(), end: end.toISOString() }))}&sort={"closedAt":-1}`;
    const data = await fetchWithAuth(url);
    const rooms = data.rooms || [];
    closed += rooms.length;
    if (rooms.length === 0) break;
    offset += rooms.length;
  }

  // ---- Em aberto (open=true) ----
  offset = 0;
  while (true) {
    const url = `${agentData.siteUrl}/livechat/rooms?agents[]=${agentId}&offset=${offset}&open=true&sort={"ts":-1}`;
    const data = await fetchWithAuth(url);
    const rooms = data.rooms || [];
    open += rooms.length;
    if (rooms.length === 0) break;
    offset += rooms.length;
  }

  return { closed, open, total: closed + open };
}

// exibe banners de status
function showBanner(message, type = "success") {
  banner.textContent = message;
  banner.className = type;
  banner.style.display = "block";
  setTimeout(() => (banner.style.display = "none"), 5000);
}

// pede os dados ao Meteor
window.parent.postMessage({ action: "getAgentName" }, "*");

// recebe os dados do Meteor
window.addEventListener("message", (event) => {
  if (event.data.action === "returnAgentName") {
    agentData = {
      agentName: event.data.agentName,
      agentId: event.data.agentId,
      token: event.data.token,
      userId: event.data.userId,
      siteUrl: event.data.siteUrl
    };
    console.log("Dados recebidos do Meteor:", agentData); // depuração
    btnVerConversas.disabled = false;
    btnIncrease.disabled = false;
  }
});

// botão Ver Conversas
btnVerConversas.addEventListener("click", async () => {
  if (!agentData || !agentData.agentName) return;
  const selectedDate = inputData.value || new Date().toISOString().split("T")[0];
  infoDiv.style.display = "block";
  infoDiv.textContent = "Carregando...";
  try {
    const user = await getUserByUsername(agentData.agentName);
    const { closed, open, total } = await getChatsByDate(user._id, selectedDate);

    const [year, month, day] = selectedDate.split("-");
    const dataFormatada = `${day}/${month}/${year}`;

    infoDiv.textContent = `Data: ${dataFormatada} | Finalizadas: ${closed} | Em aberto: ${open} | Total: ${total}`;
  } catch (err) {
    infoDiv.textContent = `Erro: ${err.message}`;
  }
});
