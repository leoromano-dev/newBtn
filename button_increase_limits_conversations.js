async function getOpenChats(agentId) {
  const url = `${agentData.siteUrl}/livechat/rooms?agents[]=${agentId}&open=true&queued=false&onhold=false&count=100&sort={"ts":-1}`;
  const data = await fetchWithAuth(url);
  return data.rooms ? data.rooms.length : 0;
}

async function getAgentLivechatInfo(agentId) {
  const data = await fetchWithAuth(`${agentData.siteUrl}/livechat/users/agent/${encodeURIComponent(agentId)}`);
  if (!data.user) throw new Error("Agente não encontrado");
  return data.user;
}

async function getAgentDepartments(userId) {
  const res = await fetch(`${agentData.siteUrl}/livechat/agents/${encodeURIComponent(userId)}/departments`, {
    headers: { "X-Auth-Token": agentData.token, "X-User-Id": agentData.userId }
  });
  if (!res.ok) throw new Error("Erro ao buscar departamentos do agente");
  const data = await res.json();
  return data.departments ? data.departments.map(d => d.departmentId) : [];
}

async function updateAgentLimit(agentId, agentInfo, newLimit) {
  const departmentIds = await getAgentDepartments(agentId);
  const bodyData = {
    message: JSON.stringify({
      msg: "method",
      id: "14",
      method: "livechat:saveAgentInfo",
      params: [
        agentId,
        {
          name: agentInfo.livechat.name,
          username: agentInfo.livechat.username,
          email: agentInfo.livechat.email || `${agentInfo.livechat.username}@sapios.com.br`,
          maxNumberSimultaneousChat: String(newLimit),
          voipExtension: agentInfo.livechat.voipExtension || "",
        },
        departmentIds
      ],
    }),
  };
  const res = await fetch(`${agentData.siteUrl}/method.call/livechat%3AsaveAgentInfo`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Auth-Token": agentData.token, "X-User-Id": agentData.userId },
    body: JSON.stringify(bodyData),
  });
  if (!res.ok) throw new Error("Erro ao atualizar limite");
  return await res.json();
}

btnIncrease.addEventListener("click", async () => {
  if (!agentData) return;
  btnIncrease.disabled = true;
  try {
    const user = await getUserByUsername(agentData.agentName);
    const agentInfo = await getAgentLivechatInfo(user._id);
    const openChats = await getOpenChats(user._id);
    const currentLimit = Number(agentInfo.livechat?.maxNumberSimultaneousChat) || 0;

    if (openChats >= currentLimit) {
      const newLimit = openChats + 1;
      await updateAgentLimit(user._id, agentInfo, newLimit);
      showBanner(`Limite aumentado para ${newLimit}`, "success");

      setTimeout(async () => {
        try { await updateAgentLimit(user._id, agentInfo, currentLimit); }
        catch(e) { console.error("Erro ao restaurar limite:", e); }
        finally { btnIncrease.disabled = false; }
      }, 10000);
    } else {
      showBanner(`Não há conversas em fila atualmente`, "error");
      btnIncrease.disabled = false;
    }
  } catch (err) {
    showBanner(`Erro: ${err.message}`, "error");
    btnIncrease.disabled = false;
  }
});