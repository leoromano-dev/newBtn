const btnVerConversas = document.getElementById("verConversasBtn");
const inputData = document.getElementById("inputData");
const infoDiv = document.getElementById("finalizadasInfo");
const btnIncrease = document.getElementById("increaseLimitBtn");
const banner = document.getElementById("limitBanner");

let agentData = null;

// Define hoje no input
(function setHoje() {
  const hoje = new Date();
  inputData.value = hoje.toISOString().split("T")[0];
})();

// Fetch com autenticação
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

// Buscar usuário
async function getUserByUsername(username) {
  const data = await fetchWithAuth(
    `${agentData.siteUrl}/users.info?username=${encodeURIComponent(username)}`
  );

  if (!data.user) throw new Error("Usuário não encontrado");
  return data.user;
}

// ✅ Corrigido (UTC-3 sem cortar horário)
function getLocalDayRange(dateStr) {
  const [year, month, day] = dateStr.split("-");

  const start = new Date(year, month - 1, day, 0, 0, 0);
  const end = new Date(year, month - 1, day, 23, 59, 59, 999);

  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

// Buscar chats
async function getChatsByDate(agentId, targetDate) {
  let closed = 0;
  let open = 0;

  const { start, end } = getLocalDayRange(targetDate);
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();

  let offset = 0;
  const limit = 50;

  while (true) {
    const url = `${agentData.siteUrl}/livechat/rooms?offset=${offset}&count=${limit}&sort=${encodeURIComponent(
      JSON.stringify({ ts: -1 })
    )}`;

    const data = await fetchWithAuth(url);
    const rooms = data.rooms || [];

    for (const room of rooms) {
      // 🔍 pega o agente correto (isso muda dependendo do Rocket)
      const servedById =
        room.servedBy?._id ||
        room.u?._id ||
        room.lastAgent?._id;

      if (servedById !== agentId) continue;

      // ---- FINALIZADAS ----
      if (room.closedAt) {
        const closedTime = new Date(room.closedAt).getTime();

        if (closedTime >= startTime && closedTime <= endTime) {
          closed++;
        }
      }

      // ---- EM ABERTO ----
      if (room.open === true) {
        const createdTime = new Date(room.ts).getTime();

        if (createdTime >= startTime && createdTime <= endTime) {
          open++;
        }
      }
    }

    if (rooms.length < limit) break;
    offset += limit;
  }

  return {
    closed,
    open,
    total: closed + open
  };
}

  while (true) {
    const url = `${agentData.siteUrl}/livechat/rooms?agents[]=${agentId}&offset=${offset}&count=${limit}&query=${encodeURIComponent(
      JSON.stringify(closedQuery)
    )}&sort=${encodeURIComponent(JSON.stringify({ closedAt: -1 }))}`;

    const data = await fetchWithAuth(url);
    const rooms = data.rooms || [];

    closed += rooms.length;

    if (rooms.length < limit) break;
    offset += limit;
  }

  // ---- EM ABERTO ----
  offset = 0;

  while (true) {
    const url = `${agentData.siteUrl}/livechat/rooms?agents[]=${agentId}&offset=${offset}&count=${limit}&open=true&sort=${encodeURIComponent(
      JSON.stringify({ ts: -1 })
    )}`;

    const data = await fetchWithAuth(url);
    const rooms = data.rooms || [];

    open += rooms.length;

    if (rooms.length < limit) break;
    offset += limit;
  }

  return {
    closed,
    open,
    total: closed + open
  };
}

// Banner
function showBanner(message, type = "success") {
  banner.textContent = message;
  banner.className = type;
  banner.style.display = "block";

  setTimeout(() => (banner.style.display = "none"), 5000);
}

// Solicita dados ao Meteor
window.parent.postMessage({ action: "getAgentName" }, "*");

// Recebe dados
window.addEventListener("message", (event) => {
  if (event.data.action === "returnAgentName") {
    agentData = {
      agentName: event.data.agentName,
      agentId: event.data.agentId,
      token: event.data.token,
      userId: event.data.userId,
      siteUrl: event.data.siteUrl
    };

    console.log("Dados recebidos:", agentData);

    btnVerConversas.disabled = false;
    btnIncrease.disabled = false;
  }
});

// Botão
btnVerConversas.addEventListener("click", async () => {
  if (!agentData || !agentData.agentName) return;

  const selectedDate =
    inputData.value || new Date().toISOString().split("T")[0];

  infoDiv.style.display = "block";
  infoDiv.textContent = "Carregando...";

  try {
    const user = await getUserByUsername(agentData.agentName);

    const { closed, open, total } = await getChatsByDate(
      user._id,
      selectedDate
    );

    const [year, month, day] = selectedDate.split("-");
    const dataFormatada = `${day}/${month}/${year}`;

    infoDiv.textContent =
      `Data: ${dataFormatada} | Finalizadas: ${closed} | Em aberto: ${open} | Total: ${total}`;
  } catch (err) {
    console.error(err);
    infoDiv.textContent = `Erro: ${err.message}`;
  }
});
