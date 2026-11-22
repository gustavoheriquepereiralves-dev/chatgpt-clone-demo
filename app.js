const $ = (selector) => document.querySelector(selector);
const shell = $('#appShell');
const conversationView = $('#conversationView');
const welcome = $('#welcome');
const messages = $('#messages');
const historyList = $('#historyList');
const input = $('#promptInput');
const sendButton = $('#sendButton');
const popover = $('#popover');
const toastNode = $('#toast');

const STORE_KEY = 'chatgpt-local-prototype-v1';
const assistantMark = '<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M20 4.4a9 9 0 0 0-8.8 7.2 8.6 8.6 0 0 0-5.1 12.1 8.7 8.7 0 0 0 7.5 12.1 9 9 0 0 0 11 0 8.7 8.7 0 0 0 7.5-12.1A8.6 8.6 0 0 0 27 11.6 9 9 0 0 0 20 4.4Z" stroke="currentColor" stroke-width="2.2"/><path d="m12 14 16 9M12 23l16-9M20 9v22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const copyIcon = '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>';

let state = loadState();
let toastTimer;
let activePopover = null;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return {
      chats: Array.isArray(saved.chats) ? saved.chats : [],
      activeId: saved.activeId || null,
      dark: Boolean(saved.dark),
      model: saved.model || 'Instantâneo'
    };
  } catch {
    return { chats: [], activeId: null, dark: false, model: 'Instantâneo' };
  }
}

function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { showToast('Não foi possível salvar no navegador.'); }
}

function currentChat() { return state.chats.find((chat) => chat.id === state.activeId) || null; }

function showToast(message) {
  toastNode.textContent = message;
  toastNode.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastNode.classList.remove('show'), 2300);
}

function titleFrom(text) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > 34 ? `${cleaned.slice(0, 33).trimEnd()}…` : cleaned;
}

function renderHistory() {
  historyList.replaceChildren();
  for (const chat of state.chats) {
    const button = document.createElement('button');
    button.className = `history-item${chat.id === state.activeId ? ' selected' : ''}`;
    button.type = 'button';
    button.title = chat.title;
    const label = document.createElement('span');
    label.textContent = chat.title;
    button.append(label);
    button.addEventListener('click', () => openChat(chat.id));
    historyList.append(button);
  }
}

function appendMessage(role, text, { typing = false } = {}) {
  const article = document.createElement('article');
  article.className = `message ${role}`;
  if (role === 'assistant') {
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = assistantMark;
    article.append(avatar);
  }
  const content = document.createElement('div');
  content.className = 'bubble';
  if (typing) {
    content.innerHTML = '<span class="typing" aria-label="Preparando resposta"><i></i><i></i><i></i></span>';
  } else {
    content.textContent = text;
  }
  article.append(content);
  if (role === 'assistant' && !typing) {
    const actions = document.createElement('div');
    actions.className = 'message-tools';
    const copy = document.createElement('button');
    copy.className = 'mini-action'; copy.type = 'button'; copy.setAttribute('aria-label', 'Copiar resposta'); copy.title = 'Copiar'; copy.innerHTML = copyIcon;
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(text); showToast('Resposta copiada.'); }
      catch { showToast('A cópia não está disponível neste navegador.'); }
    });
    actions.append(copy);
    article.append(actions);
  }
  messages.append(article);
  messages.scrollTop = messages.scrollHeight;
  return article;
}

function renderChat() {
  messages.replaceChildren();
  const chat = currentChat();
  const hasMessages = Boolean(chat?.messages?.length);
  conversationView.classList.toggle('has-messages', hasMessages);
  if (!hasMessages) return;
  for (const message of chat.messages) appendMessage(message.role, message.text);
}

function openChat(id) {
  state.activeId = id;
  saveState();
  renderHistory();
  renderChat();
  input.focus();
  if (window.innerWidth <= 700) shell.classList.add('sidebar-collapsed');
}

function newChat() {
  state.activeId = null;
  saveState();
  renderHistory();
  renderChat();
  input.value = '';
  resizeInput();
  input.focus();
  closePopover();
  if (window.innerWidth <= 700) shell.classList.add('sidebar-collapsed');
}

function responseFor(prompt) {
  const lower = prompt.toLocaleLowerCase('pt-BR');
  if (/\b(oi|olá|ola|bom dia|boa tarde|boa noite)\b/.test(lower)) {
    return 'Olá! Posso ajudar com ideias, explicações, escrita e planejamento. O que você gostaria de fazer?';
  }
  if (/planej|projeto|organizar/.test(lower)) {
    return `Vamos transformar isso em um plano simples:\n\n1. **Defina o objetivo:** escreva em uma frase o resultado que você quer alcançar.\n2. **Divida em etapas:** liste entregas pequenas que possam ser concluídas uma de cada vez.\n3. **Escolha a próxima ação:** comece pela tarefa mais curta que destrava o restante.\n4. **Revise o progresso:** reserve um momento para ajustar as prioridades.\n\nSe você me contar um pouco mais sobre o projeto, posso adaptar essas etapas.`;
  }
  if (/explica|explique|conceito|significa|como funciona/.test(lower)) {
    return 'Claro! Pense no assunto como uma ideia com três partes: o que é, para que serve e como aparece no dia a dia.\n\nPara explicar com precisão, me diga qual conceito você quer entender e o quanto já conhece sobre ele.';
  }
  if (/escrev|mensagem|texto|email|e-mail/.test(lower)) {
    return 'Posso ajudar a montar esse texto. Uma estrutura que costuma funcionar é:\n\n• Comece dizendo o motivo da mensagem.\n• Explique o ponto principal em uma ou duas frases.\n• Termine com um próximo passo claro e cordial.\n\nConte para quem é a mensagem e qual tom você quer usar para eu preparar um rascunho.';
  }
  if (/ideia|criativ|fim de semana|sugira/.test(lower)) {
    return 'Aqui vão alguns caminhos para explorar:\n\n• Faça algo que nunca experimentou na sua região.\n• Escolha um tema e monte um pequeno projeto de uma tarde.\n• Convide alguém para trocar recomendações de livros, filmes ou lugares.\n\nSe você disser seus interesses e quanto tempo tem, posso sugerir opções mais específicas.';
  }
  return `Entendi. Posso ajudar você a desenvolver essa ideia.\n\nUma boa forma de começar é separar o que já está claro do que ainda precisa de decisão. Qual resultado você espera obter com “${prompt.length > 120 ? `${prompt.slice(0, 117)}…` : prompt}”?\n\n_Resposta demonstrativa do protótipo local._`;
}

function sendMessage(text = input.value) {
  const prompt = text.trim();
  if (!prompt) return;
  let chat = currentChat();
  if (!chat) {
    chat = { id: crypto.randomUUID(), title: titleFrom(prompt), messages: [], updatedAt: Date.now() };
    state.chats.unshift(chat);
    state.activeId = chat.id;
  }
  chat.messages.push({ role: 'user', text: prompt });
  chat.updatedAt = Date.now();
  if (chat.messages.length === 1) chat.title = titleFrom(prompt);
  input.value = '';
  resizeInput();
  saveState();
  renderHistory();
  renderChat();
  appendMessage('assistant', '', { typing: true });
  sendButton.disabled = true;
  window.setTimeout(() => {
    const answer = responseFor(prompt);
    chat.messages.push({ role: 'assistant', text: answer });
    chat.updatedAt = Date.now();
    saveState();
    renderChat();
    input.focus();
  }, 800);
}

function resizeInput() {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
  sendButton.disabled = input.value.trim().length === 0;
}

function closePopover() {
  popover.hidden = true;
  popover.replaceChildren();
  activePopover = null;
  $('#modelSelect').setAttribute('aria-expanded', 'false');
}

function menuButton(label, description, action) {
  const button = document.createElement('button');
  button.className = 'menu-option'; button.type = 'button';
  const text = document.createElement('span');
  text.textContent = label;
  if (description) { const small = document.createElement('small'); small.textContent = description; text.append(small); }
  button.append(text);
  button.addEventListener('click', () => { closePopover(); action(); });
  return button;
}

function showMenu(kind, anchor) {
  if (activePopover === kind) { closePopover(); return; }
  popover.replaceChildren();
  activePopover = kind;
  const rect = anchor.getBoundingClientRect();
  popover.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - 230))}px`;
  popover.style.right = 'auto';
  popover.style.top = `${Math.min(rect.bottom + 7, window.innerHeight - 230)}px`;
  if (kind === 'model') {
    popover.append(menuButton('Instantâneo', 'Respostas rápidas', () => setModel('Instantâneo')));
    popover.append(menuButton('Pensando', 'Respostas mais elaboradas', () => setModel('Pensando')));
    popover.append(menuButton('Saiba mais sobre modelos', '', () => showToast('Os modelos são apenas uma opção visual neste protótipo.')));
    $('#modelSelect').setAttribute('aria-expanded', 'true');
  } else if (kind === 'more') {
    popover.append(menuButton(state.dark ? 'Usar tema claro' : 'Usar tema escuro', 'Alternar aparência', toggleTheme));
    const divider = document.createElement('div'); divider.className = 'menu-divider'; popover.append(divider);
    popover.append(menuButton('Iniciar nova conversa', '', newChat));
    popover.append(menuButton('Limpar conversas', 'Apaga o histórico salvo neste navegador', clearChats));
  } else if (kind === 'tools') {
    popover.append(menuButton('Pesquisar na web', 'Demonstração visual, sem busca real', () => showToast('A pesquisa na web não está conectada.')));
    popover.append(menuButton('Analisar dados', 'Disponível apenas em uma versão conectada', () => showToast('Ferramenta demonstrativa.')));
    popover.append(menuButton('Criar imagem', 'Disponível apenas em uma versão conectada', () => showToast('Ferramenta demonstrativa.')));
  }
  popover.hidden = false;
}

function setModel(model) {
  state.model = model; saveState();
  $('#modelSelect').innerHTML = `<span>ChatGPT</span><span class="model-tier">${model === 'Pensando' ? 'Pensando ▾' : 'Instantâneo ▾'}</span>`;
  showToast(`Modo ${model.toLocaleLowerCase('pt-BR')} selecionado.`);
}

function toggleTheme() {
  state.dark = !state.dark;
  document.body.classList.toggle('dark', state.dark);
  saveState();
  showToast(state.dark ? 'Tema escuro ativado.' : 'Tema claro ativado.');
}

function clearChats() {
  if (!state.chats.length) { showToast('O histórico já está vazio.'); return; }
  if (!window.confirm('Remover todas as conversas salvas neste navegador?')) return;
  state.chats = []; state.activeId = null; saveState(); renderHistory(); renderChat();
  showToast('Conversas removidas deste navegador.');
}

$('#composerForm').addEventListener('submit', (event) => { event.preventDefault(); sendMessage(); });
input.addEventListener('input', resizeInput);
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }
});
$('#newChatButton').addEventListener('click', newChat);
$('#sidebarToggle').addEventListener('click', () => shell.classList.add('sidebar-collapsed'));
$('#openSidebar').addEventListener('click', () => shell.classList.remove('sidebar-collapsed'));
$('#modelSelect').addEventListener('click', (event) => showMenu('model', event.currentTarget));
$('#moreButton').addEventListener('click', (event) => showMenu('more', event.currentTarget));
$('#toolsButton').addEventListener('click', (event) => showMenu('tools', event.currentTarget));
$('#webSearchButton').addEventListener('click', (event) => {
  event.currentTarget.classList.toggle('enabled');
  showToast(event.currentTarget.classList.contains('enabled') ? 'Pesquisa visual selecionada; sem conexão com a web.' : 'Pesquisa visual desativada.');
});
$('#attachButton').addEventListener('click', () => $('#fileInput').click());
$('#fileInput').addEventListener('change', (event) => {
  const files = [...event.target.files];
  if (files.length) showToast(`${files.length} arquivo(s) selecionado(s); anexos são demonstrativos.`);
  event.target.value = '';
});
$('#voiceButton').addEventListener('click', () => showToast('A conversa por voz não está conectada neste protótipo.'));
$('#shareButton').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); showToast('Link local copiado.'); }
  catch { showToast('Este protótipo ainda não cria links compartilháveis.'); }
});
$('#searchButton').addEventListener('click', () => {
  const query = window.prompt('Buscar nas conversas salvas:');
  if (query === null) return;
  const match = state.chats.find((chat) => chat.title.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
  if (match) openChat(match.id); else showToast('Nenhuma conversa encontrada.');
});
$('#libraryButton').addEventListener('click', () => showToast('A biblioteca não está conectada neste protótipo.'));
$('#addProject').addEventListener('click', () => showToast('Projetos são apenas demonstrativos nesta versão.'));
$('#newProject').addEventListener('click', () => showToast('Projetos não estão conectados neste protótipo.'));
$('#planButton').addEventListener('click', () => showToast('Esta versão local não oferece planos ou pagamentos.'));
$('#profileButton').addEventListener('click', () => showToast('Perfil de demonstração — nenhuma conta conectada.'));
for (const button of document.querySelectorAll('.suggestion')) button.addEventListener('click', () => sendMessage(button.dataset.prompt));
document.addEventListener('click', (event) => {
  if (!popover.hidden && !popover.contains(event.target) && !event.target.closest('#modelSelect, #moreButton, #toolsButton')) closePopover();
});
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); newChat(); }
  if (event.key === 'Escape') closePopover();
});

document.body.classList.toggle('dark', state.dark);
if (state.model !== 'Instantâneo') $('#modelSelect').innerHTML = `<span>ChatGPT</span><span class="model-tier">${state.model} ▾</span>`;
renderHistory();
renderChat();
resizeInput();
if (window.innerWidth <= 700) shell.classList.add('sidebar-collapsed');
