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
const MODELS = [
  { name: 'Astra 6', description: 'Equilibrado para tarefas do dia a dia' },
  { name: 'Luna 6', description: 'Respostas rápidas e diretas' },
  { name: 'Orion 5', description: 'Análise, raciocínio e código' },
  { name: 'Vega 5', description: 'Escrita e ideias criativas' }
];
const EFFORT_LEVELS = ['Baixo', 'Médio', 'Alto', 'Máximo'];
const PLANS = [
  { name: 'Free', description: 'Acesso essencial para começar', detail: 'Modelos básicos e esforço baixo ou médio' },
  { name: 'Plus', description: 'Mais recursos para uso frequente', detail: 'Todos os modelos e esforço alto' },
  { name: 'Pro', description: 'Para tarefas mais exigentes', detail: 'Todos os modelos e esforço máximo' },
  { name: 'Team', description: 'Um espaço para trabalhar em equipe', detail: 'Recursos compartilhados em uma demonstração' }
];
const assistantMark = '<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M20 4.4a9 9 0 0 0-8.8 7.2 8.6 8.6 0 0 0-5.1 12.1 8.7 8.7 0 0 0 7.5 12.1 9 9 0 0 0 11 0 8.7 8.7 0 0 0 7.5-12.1A8.6 8.6 0 0 0 27 11.6 9 9 0 0 0 20 4.4Z" stroke="currentColor" stroke-width="2.2"/><path d="m12 14 16 9M12 23l16-9M20 9v22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const copyIcon = '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>';

let state = loadState();
let toastTimer;
let activePopover = null;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    const chats = Array.isArray(saved.chats) ? saved.chats : [];
    for (const chat of chats) for (const message of chat.messages || []) {
      if (message.role === 'assistant' && message.text?.includes('Resposta demonstrativa do protótipo local.')) {
        message.text = 'Esta resposta antiga era apenas demonstrativa. Envie sua pergunta novamente para consultar fontes atuais.';
      }
    }
    return {
      chats,
      activeId: saved.activeId || null,
      dark: Boolean(saved.dark),
      model: MODELS.some((model) => model.name === saved.model) ? saved.model : 'Astra 6',
      effort: EFFORT_LEVELS.includes(saved.effort) ? saved.effort : 'Médio',
      plan: PLANS.some((plan) => plan.name === saved.plan) ? saved.plan : 'Free'
    };
  } catch {
    return { chats: [], activeId: null, dark: false, model: 'Astra 6', effort: 'Médio', plan: 'Free' };
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

function appendMessage(role, text, { typing = false, sources = [] } = {}) {
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
  if (role === 'assistant' && !typing && sources.length) {
    const sourceList = document.createElement('div');
    sourceList.className = 'message-sources';
    const label = document.createElement('span'); label.textContent = 'Fontes consultadas'; sourceList.append(label);
    sources.slice(0, 4).forEach((source) => sourceList.append(safeExternalLink(source.title, source.url, 'message-source-link')));
    article.append(sourceList);
  }
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
  for (const message of chat.messages) appendMessage(message.role, message.text, { sources: message.sources || [] });
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
  return 'Olá! Posso consultar fontes públicas para responder perguntas com informações atuais.';
}

function responseFromSources(prompt, sources) {
  const relevant = sources.filter((source) => source.description).slice(0, 3);
  if (!relevant.length) {
    return `Não encontrei trechos úteis nas fontes públicas consultadas para “${prompt}”. Você pode tentar reformular a busca ou abrir um buscador para ampliar os resultados. Esta conversa ainda não está conectada a um modelo de IA.`;
  }
  const excerpts = relevant.map((source) => `• ${source.description}`).join('\n\n');
  return `Pesquisei “${prompt}” agora. Estes são os trechos mais relevantes que encontrei:\n\n${excerpts}\n\nO resumo acima foi montado a partir dos trechos das fontes listadas; abra os links para conferir o contexto completo.`;
}

async function searchChatSources(prompt) {
  const searches = [
    searchWiki('https://pt.wikipedia.org/w/api.php', 'pt', prompt),
    searchWiki('https://en.wikipedia.org/w/api.php', 'en', prompt)
  ];
  if (/\b(código|codigo|programa|programar|site|aplicativo|app|react|javascript|python|html|css|github|software)\b/i.test(prompt)) searches.push(searchGitHub(prompt));
  const results = await Promise.allSettled(searches);
  return results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
}

async function sendMessage(text = input.value) {
  const prompt = text.trim();
  if (!prompt || sendButton.disabled) return;
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
  const activeRequestId = chat.id;
  appendMessage('assistant', '', { typing: true });
  sendButton.disabled = true;
  try {
    const greeting = /^(oi|olá|ola|bom dia|boa tarde|boa noite)[!. ]*$/i.test(prompt);
    const sources = greeting ? [] : await searchChatSources(prompt);
    const answer = greeting ? responseFor(prompt) : responseFromSources(prompt, sources);
    chat.messages.push({ role: 'assistant', text: answer, sources });
  } catch {
    const answer = 'Não consegui consultar as fontes agora. Confira sua conexão e tente novamente. Esta conversa precisa de uma conexão com um serviço de IA para responder sem pesquisa.';
    chat.messages.push({ role: 'assistant', text: answer });
  } finally {
    chat.updatedAt = Date.now();
    saveState();
    renderHistory();
    if (state.activeId === activeRequestId) { renderChat(); input.focus(); }
    sendButton.disabled = input.value.trim().length === 0;
  }
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
  $('#planButton').setAttribute('aria-expanded', 'false');
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
  popover.className = `popover${kind === 'model' || kind === 'plans' ? ' popover-wide' : ''}`;
  const rect = anchor.getBoundingClientRect();
  const width = kind === 'model' || kind === 'plans' ? 340 : 230;
  popover.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
  popover.style.right = 'auto';
  popover.style.top = `${Math.min(rect.bottom + 7, window.innerHeight - (kind === 'plans' ? 360 : kind === 'model' ? 480 : 230))}px`;
  if (kind === 'model') {
    popover.append(sectionLabel('Modelo'));
    for (const model of MODELS) {
      const option = menuButton(model.name, model.description, () => setModel(model.name));
      option.classList.toggle('selected-option', state.model === model.name);
      option.setAttribute('aria-pressed', String(state.model === model.name));
      popover.append(option);
    }
    popover.append(divider());
    popover.append(sectionLabel('Nível de esforço'));
    const effortGrid = document.createElement('div');
    effortGrid.className = 'effort-grid';
    for (const level of EFFORT_LEVELS) {
      const option = document.createElement('button');
      option.className = `effort-choice${state.effort === level ? ' selected-option' : ''}`;
      option.type = 'button';
      option.textContent = level;
      option.setAttribute('aria-pressed', String(state.effort === level));
      option.addEventListener('click', () => { closePopover(); setEffort(level); });
      effortGrid.append(option);
    }
    popover.append(effortGrid);
    popover.append(divider());
    popover.append(menuButton('Sobre este protótipo', 'Os modelos e níveis são demonstrativos', () => showToast('Nenhum modelo de IA está conectado.')));
    $('#modelSelect').setAttribute('aria-expanded', 'true');
  } else if (kind === 'plans') {
    popover.append(sectionLabel('Escolha um plano'));
    for (const plan of PLANS) {
      const option = menuButton(`${plan.name}${state.plan === plan.name ? ' · atual' : ''}`, `${plan.description} — ${plan.detail}`, () => setPlan(plan.name));
      option.classList.toggle('selected-option', state.plan === plan.name);
      option.setAttribute('aria-pressed', String(state.plan === plan.name));
      popover.append(option);
    }
    popover.append(divider());
    const note = document.createElement('p');
    note.className = 'popover-note';
    note.textContent = 'Planos demonstrativos. Não há cobrança nem recursos pagos ativos.';
    popover.append(note);
    $('#planButton').setAttribute('aria-expanded', 'true');
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

function sectionLabel(label) {
  const heading = document.createElement('div');
  heading.className = 'popover-section-label';
  heading.textContent = label;
  return heading;
}

function divider() {
  const line = document.createElement('div');
  line.className = 'menu-divider';
  return line;
}

function renderModelSelect() {
  $('#modelSelect').innerHTML = `<span>ChatGPT</span><span class="model-tier">${state.model} · esforço ${state.effort.toLocaleLowerCase('pt-BR')} ▾</span>`;
  $('#modelSelect').setAttribute('aria-label', `ChatGPT, modelo ${state.model}, esforço ${state.effort}`);
}

function setModel(model) {
  state.model = model; saveState();
  renderModelSelect();
  showToast(`${model} selecionado.`);
}

function setEffort(level) {
  state.effort = level; saveState(); renderModelSelect();
  showToast(`Nível de esforço ${level.toLocaleLowerCase('pt-BR')} selecionado.`);
}

function setPlan(plan) {
  state.plan = plan; saveState();
  $('#planSummary').textContent = `Plano atual: ${plan}`;
  $('#profilePlan').textContent = `Plano ${plan}`;
  showToast(`Plano ${plan} selecionado para esta demonstração.`);
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

const researchOverlay = $('#researchOverlay');
const researchForm = $('#researchForm');
const researchInput = $('#researchInput');
const researchResults = $('#researchResults');
const searchEngines = $('#searchEngines');
const builderOverlay = $('#builderOverlay');
const builderPrompt = $('#builderPrompt');
const codeEditor = $('#codeEditor');
const projectPreview = $('#projectPreview');
let projectFiles = {};
let activeProjectFile = '';
let projectResearchContext = [];
let lastResearchContext = [];
let lastResearchQuery = '';

function openWorkspace(panel) {
  closePopover();
  panel.hidden = false;
  document.body.classList.add('workspace-open');
  (panel === researchOverlay ? researchInput : panel === builderOverlay ? builderPrompt : panel.querySelector('button, input, textarea'))?.focus();
}

function closeWorkspaces() {
  researchOverlay.hidden = true;
  builderOverlay.hidden = true;
  document.body.classList.remove('workspace-open');
}

function plainSnippet(markup) {
  const documentCopy = new DOMParser().parseFromString(markup || '', 'text/html');
  return (documentCopy.body.textContent || '').replace(/\s+/g, ' ').trim();
}

async function searchWiki(endpoint, lang, query) {
  const params = new URLSearchParams({ action: 'query', list: 'search', srsearch: query, srprop: 'snippet', srlimit: '4', format: 'json', origin: '*' });
  const response = await fetch(`${endpoint}?${params}`);
  if (!response.ok) throw new Error(`${lang}: HTTP ${response.status}`);
  const data = await response.json();
  const entries = data.query?.search || [];
  const pageIds = entries.map((entry) => entry.pageid).filter(Boolean);
  let extracts = {};
  if (pageIds.length) {
    const extractParams = new URLSearchParams({ action: 'query', pageids: pageIds.join('|'), prop: 'extracts', exintro: '1', explaintext: '1', exchars: '900', format: 'json', origin: '*' });
    const extractResponse = await fetch(`${endpoint}?${extractParams}`);
    if (extractResponse.ok) {
      const extractData = await extractResponse.json();
      extracts = extractData.query?.pages || {};
    }
  }
  return entries.map((entry) => ({
    source: `Wikipedia ${lang}`,
    title: entry.title,
    description: extracts[entry.pageid]?.extract || plainSnippet(entry.snippet),
    url: `https://${lang === 'pt' ? 'pt' : 'en'}.wikipedia.org/wiki/${encodeURIComponent(entry.title.replace(/ /g, '_'))}`
  }));
}

async function searchGitHub(query) {
  const params = new URLSearchParams({ q: query, sort: 'stars', order: 'desc', per_page: '4' });
  const response = await fetch(`https://api.github.com/search/repositories?${params}`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) throw new Error(`GitHub: HTTP ${response.status}`);
  const data = await response.json();
  return (data.items || []).map((repo) => ({
    source: 'Projetos públicos no GitHub',
    title: repo.full_name,
    description: repo.description || 'Repositório público sem descrição.',
    url: repo.html_url,
    meta: `★ ${Number(repo.stargazers_count || 0).toLocaleString('pt-BR')} estrelas`
  }));
}

function safeExternalLink(label, url, className = '') {
  const link = document.createElement('a');
  link.className = className;
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = label;
  return link;
}

function renderSearchGroup(title, items, error = '') {
  const group = document.createElement('section');
  group.className = 'research-group';
  const heading = document.createElement('h3'); heading.textContent = title; group.append(heading);
  if (error) { const note = document.createElement('p'); note.className = 'empty-state'; note.textContent = error; group.append(note); return group; }
  if (!items.length) { const note = document.createElement('p'); note.className = 'empty-state'; note.textContent = 'Nenhum resultado encontrado nesta fonte.'; group.append(note); return group; }
  for (const item of items) {
    const card = document.createElement('article'); card.className = 'research-card';
    const source = document.createElement('span'); source.className = 'result-source'; source.textContent = item.source;
    const link = safeExternalLink(item.title, item.url, 'result-title');
    const excerpt = document.createElement('p'); excerpt.textContent = item.description;
    card.append(source, link, excerpt);
    if (item.meta) { const meta = document.createElement('small'); meta.className = 'result-meta'; meta.textContent = item.meta; card.append(meta); }
    group.append(card);
  }
  return group;
}

async function runResearch(query) {
  const cleaned = query.trim();
  if (!cleaned) return;
  researchResults.replaceChildren();
  const loading = document.createElement('p'); loading.className = 'empty-state'; loading.textContent = 'Consultando fontes públicas em paralelo…'; researchResults.append(loading);
  searchEngines.replaceChildren();
  searchEngines.hidden = false;
  searchEngines.append(document.createTextNode('Buscar em: '));
  const encoded = encodeURIComponent(cleaned);
  searchEngines.append(
    safeExternalLink('Google', `https://www.google.com/search?q=${encoded}`, 'engine-link'),
    safeExternalLink('Bing', `https://www.bing.com/search?q=${encoded}`, 'engine-link'),
    safeExternalLink('Google Notícias', `https://news.google.com/search?q=${encoded}&hl=pt-BR&gl=BR&ceid=BR:pt-419`, 'engine-link'),
    safeExternalLink('Tutoriais', `https://www.google.com/search?q=${encodeURIComponent(`${cleaned} tutorial`)}`, 'engine-link'),
    safeExternalLink('Documentação oficial', `https://www.google.com/search?q=${encodeURIComponent(`${cleaned} documentação oficial`)}`, 'engine-link')
  );
  const sources = [
    { title: 'Wikipedia em português', request: searchWiki('https://pt.wikipedia.org/w/api.php', 'pt', cleaned) },
    { title: 'Wikipedia em inglês', request: searchWiki('https://en.wikipedia.org/w/api.php', 'en', cleaned) },
    { title: 'GitHub — projetos públicos', request: searchGitHub(cleaned) }
  ];
  const results = await Promise.allSettled(sources.map((source) => source.request));
  researchResults.replaceChildren();
  lastResearchQuery = cleaned;
  lastResearchContext = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  $('#researchToBuilder').hidden = lastResearchContext.length === 0;
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') researchResults.append(renderSearchGroup(sources[index].title, result.value));
    else researchResults.append(renderSearchGroup(sources[index].title, [], 'Esta fonte não respondeu agora. Tente novamente ou abra uma busca externa.'));
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function projectTitle(prompt) {
  const text = prompt.trim().replace(/\s+/g, ' ');
  if (!text) return 'Seu próximo projeto';
  return text.length > 62 ? `${text.slice(0, 59).trimEnd()}…` : text;
}

function projectBody(type, title, prompt) {
  const safeTitle = escapeHtml(title);
  const safePrompt = escapeHtml(prompt || 'Uma experiência digital clara, responsiva e feita para as pessoas.');
  if (type === 'store') return `<section class="hero"><span class="badge">LOJA ONLINE</span><h1>${safeTitle}</h1><p>${safePrompt}</p><a class="button" href="#produtos">Ver produtos</a></section><section class="section" id="produtos"><div class="section-head"><div><span class="eyebrow">SELEÇÃO DA CASA</span><h2>Produtos em destaque</h2></div><span class="cart-count">Sacola <b id="cartCount">0</b></span></div><div class="cards">${['Essencial', 'Clássico', 'Edição especial'].map((name, index) => `<article class="card product"><div class="product-art art-${index + 1}">✦</div><span class="eyebrow">COLEÇÃO 2026</span><h3>${name}</h3><p>Uma escolha especial, pensada para durar.</p><div class="price-row"><strong>R$ ${(89 + index * 50).toFixed(2).replace('.', ',')}</strong><button class="add-cart">Adicionar</button></div></article>`).join('')}</div></section><section class="section contact" id="contato"><h2>Uma compra mais simples começa aqui.</h2><a class="button secondary" href="mailto:contato@exemplo.com">Fale com a loja</a></section>`;
  if (type === 'portfolio') return `<section class="hero"><span class="badge">PORTFÓLIO • CRIATIVIDADE EM MOVIMENTO</span><h1>${safeTitle}</h1><p>${safePrompt}</p><a class="button" href="#trabalhos">Explorar trabalhos</a></section><section class="section" id="trabalhos"><span class="eyebrow">PROJETOS SELECIONADOS</span><h2>Ideias que viraram realidade</h2><div class="cards">${['Identidade visual', 'Experiência digital', 'Direção criativa'].map((name, index) => `<article class="card project-card"><div class="project-art art-${index + 1}">${String(index + 1).padStart(2, '0')}</div><h3>${name}</h3><p>Pesquisa, conceito e execução com atenção a cada detalhe.</p></article>`).join('')}</div></section>`;
  if (type === 'dashboard') return `<section class="dashboard-head"><div><span class="eyebrow">VISÃO GERAL</span><h1>${safeTitle}</h1><p>${safePrompt}</p></div><button class="button">Novo relatório</button></section><section class="metric-grid">${[['Projetos ativos', '24', '+12% este mês'], ['Receita total', 'R$ 48.290', '+8% este mês'], ['Clientes', '1.284', '+4% este mês']].map(([name, value, change]) => `<article class="card metric"><span>${name}</span><strong>${value}</strong><small>${change}</small></article>`).join('')}</section><section class="section card table-card"><div class="section-head"><h2>Atividade recente</h2><button class="text-button">Ver tudo</button></div><div class="table-row table-label"><span>Nome</span><span>Status</span><span>Atualização</span></div>${[['Projeto Aurora', 'Em andamento', 'Hoje'], ['Nova experiência', 'Em revisão', 'Ontem'], ['Campanha de verão', 'Concluído', '12 nov']].map((row) => `<div class="table-row"><strong>${row[0]}</strong><span>${row[1]}</span><span>${row[2]}</span></div>`).join('')}</section>`;
  if (type === 'login') return `<section class="auth-layout"><div class="auth-promo"><span class="badge">BEM-VINDO</span><h1>${safeTitle}</h1><p>${safePrompt}</p><div class="auth-decoration">✦</div></div><form class="card auth-card" id="authForm"><span class="eyebrow">SUA CONTA</span><h2>Entrar ou criar conta</h2><label>Seu nome<input name="name" placeholder="Como podemos chamar você?" required></label><label>E-mail<input name="email" type="email" placeholder="voce@exemplo.com" required></label><label>Senha<input name="password" type="password" placeholder="Mínimo de 8 caracteres" minlength="8" required></label><button class="button" type="submit">Continuar</button><small id="authMessage">Exemplo visual: este formulário não cria uma conta real.</small></form></section>`;
  return `<section class="hero"><span class="badge">UMA IDEIA, NOVAS POSSIBILIDADES</span><h1>${safeTitle}</h1><p>${safePrompt}</p><a class="button" href="#sobre">Começar agora <span>↗</span></a><div class="hero-orbit orbit-one"></div><div class="hero-orbit orbit-two"></div></section><section class="section" id="sobre"><div class="section-head"><div><span class="eyebrow">FEITO PARA AVANÇAR</span><h2>Um bom começo para sua ideia</h2></div><p>Uma estrutura flexível para apresentar, explicar e convidar à próxima etapa.</p></div><div class="cards">${[['01', 'Clareza', 'Conte o que importa com uma mensagem simples.'], ['02', 'Confiança', 'Mostre detalhes e diferenciais com organização.'], ['03', 'Ação', 'Ajude cada visitante a dar o próximo passo.']].map(([number, name, description]) => `<article class="card feature"><span class="feature-number">${number}</span><h3>${name}</h3><p>${description}</p></article>`).join('')}</div></section><section class="section contact" id="contato"><span class="eyebrow">VAMOS CONVERSAR</span><h2>Vamos construir algo que faça sentido.</h2><p>Conte um pouco mais sobre o que você precisa.</p><a class="button secondary" href="mailto:contato@exemplo.com">Entre em contato</a></section>`;
}

function generatedCss() {
  return `:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#17231f;background:#f5f7f4;font-synthesis:none;text-rendering:optimizeLegibility;--ink:#17231f;--muted:#66736d;--line:#dce4dc;--brand:#176b50;--soft:#e3efe6;--paper:#fff}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0}a{color:inherit;text-decoration:none}.site-nav{height:76px;display:flex;align-items:center;justify-content:space-between;padding:0 max(6vw,24px);background:#ffffffd9;border-bottom:1px solid var(--line);position:sticky;top:0;backdrop-filter:blur(12px);z-index:2}.brand{font-weight:750;letter-spacing:-.04em}.nav-links{display:flex;gap:22px;color:var(--muted);font-size:14px}.hero{min-height:480px;padding:100px max(8vw,28px);position:relative;overflow:hidden;background:radial-gradient(ellipse at 80% 20%,#d4e7d5 0,transparent 35%),linear-gradient(130deg,#f4f7f2,#e9f1eb);display:flex;flex-direction:column;align-items:flex-start;justify-content:center}.hero>*:not(.hero-orbit){position:relative;z-index:1}.hero h1{font-size:clamp(38px,7vw,76px);line-height:1.02;letter-spacing:-.065em;max-width:820px;margin:18px 0}.hero p{max-width:640px;color:var(--muted);font-size:18px;line-height:1.7}.badge,.eyebrow{color:var(--brand);font-size:11px;font-weight:750;letter-spacing:.13em}.button{display:inline-flex;gap:12px;align-items:center;border:0;border-radius:999px;padding:14px 20px;background:var(--brand);color:white;font-weight:650;font-size:14px;margin-top:15px;cursor:pointer}.button.secondary{background:var(--soft);color:var(--brand)}.hero-orbit{position:absolute;border:1px solid #176b501c;border-radius:50%;width:430px;height:430px;right:7%;top:12%}.orbit-two{width:310px;height:310px;right:12%;top:24%;border-color:#176b502a}.section{padding:76px max(8vw,28px)}.section h2,.dashboard-head h1{font-size:clamp(27px,4vw,43px);letter-spacing:-.05em;margin:12px 0}.section-head{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-bottom:25px}.section-head>p{max-width:360px;color:var(--muted);line-height:1.6}.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.card{background:var(--paper);border:1px solid var(--line);border-radius:19px;padding:24px}.feature-number{display:block;color:var(--brand);font-size:13px;font-weight:700;margin-bottom:40px}.card h3{font-size:18px}.card p{color:var(--muted);line-height:1.65;font-size:14px}.contact{background:#173f32;color:white}.contact .eyebrow{color:#a9d9b4}.contact p{color:#c9d7ce}.contact .button{margin-top:10px}.product-art,.project-art{height:190px;border-radius:13px;background:linear-gradient(145deg,#d7e8dc,#93b49e);display:grid;place-items:center;font-size:44px;color:#367456;margin-bottom:20px}.art-2{background:linear-gradient(145deg,#f1e2ce,#d2a978)}.art-3{background:linear-gradient(145deg,#e3ddf3,#ac9acb)}.price-row,.section-head{display:flex;justify-content:space-between;align-items:center;gap:16px}.add-cart,.text-button{border:1px solid var(--line);background:white;color:var(--brand);border-radius:999px;padding:9px 13px;cursor:pointer}.cart-count{border:1px solid var(--line);border-radius:999px;padding:9px 13px;font-size:13px}.dashboard-head{padding:50px max(5vw,24px) 24px;display:flex;justify-content:space-between;align-items:center}.metric-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:10px max(5vw,24px)}.metric{display:grid;gap:14px}.metric>span,.metric small{color:var(--muted);font-size:13px}.metric>strong{font-size:28px}.metric small{color:var(--brand)}.table-card{margin:24px max(5vw,24px) 70px}.table-row{display:grid;grid-template-columns:2fr 1fr 1fr;padding:15px 3px;border-bottom:1px solid var(--line);font-size:13px}.table-label{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.07em}.auth-layout{min-height:80vh;display:grid;grid-template-columns:1fr minmax(300px,430px);gap:50px;align-items:center;padding:7vw}.auth-promo{position:relative;min-height:370px;display:flex;flex-direction:column;justify-content:center}.auth-promo h1{font-size:clamp(38px,6vw,68px);letter-spacing:-.06em}.auth-promo p{max-width:500px;color:var(--muted);font-size:17px;line-height:1.6}.auth-decoration{font-size:150px;color:#bdd8c4;position:absolute;right:6%;bottom:0}.auth-card{display:grid;gap:15px}.auth-card label{display:grid;gap:7px;color:var(--muted);font-size:12px}.auth-card input{width:100%;border:1px solid var(--line);border-radius:9px;padding:12px;font:inherit}.auth-card small{color:var(--muted);line-height:1.5}.cart-message{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--ink);color:white;padding:11px 15px;border-radius:999px;font-size:13px}@media(max-width:760px){.site-nav{height:62px;padding:0 20px}.nav-links{gap:10px;font-size:12px}.hero{min-height:410px;padding:70px 25px}.hero-orbit{width:210px;height:210px;right:-60px;top:30px}.orbit-two{width:150px;height:150px;right:-30px;top:60px}.hero p{font-size:15px}.section{padding:55px 22px}.section-head{align-items:flex-start;flex-direction:column}.cards,.metric-grid{grid-template-columns:1fr}.dashboard-head{align-items:flex-start;flex-direction:column;padding:35px 22px 10px}.metric-grid{padding:10px 22px}.table-card{margin:20px 22px 50px}.table-row{grid-template-columns:1.3fr 1fr .7fr;font-size:11px}.auth-layout{grid-template-columns:1fr;gap:18px;padding:35px 22px}.auth-promo{min-height:250px}.auth-decoration{font-size:100px}.product-art,.project-art{height:145px}}`;
}

function generatedScript(type) {
  if (type === 'store') return `let cartCount=0;document.querySelectorAll('.add-cart').forEach(button=>button.addEventListener('click',()=>{cartCount+=1;document.querySelector('#cartCount').textContent=cartCount;button.textContent='Adicionado';setTimeout(()=>button.textContent='Adicionar',900)}));`;
  if (type === 'login') return `document.querySelector('#authForm')?.addEventListener('submit',event=>{event.preventDefault();document.querySelector('#authMessage').textContent='Formulário demonstrativo enviado neste navegador.'});`;
  return `document.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',()=>{}));`;
}

const projectMotionCss = `@keyframes riseIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}@keyframes drift{from{transform:translateY(-8px) rotate(-6deg)}to{transform:translateY(10px) rotate(6deg)}}.hero>*:not(.hero-orbit){animation:riseIn .65s both}.hero>*:nth-child(2){animation-delay:.08s}.hero>*:nth-child(3){animation-delay:.16s}.hero-orbit{animation:drift 9s ease-in-out infinite alternate}.orbit-two{animation-delay:-4s}.card{transition:transform .2s,box-shadow .2s}.card:hover{transform:translateY(-4px);box-shadow:0 16px 38px #173f3212}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;scroll-behavior:auto!important}}`;

function sourceSectionMarkup(sources = []) {
  const entries = sources.slice(0, 6).filter((item) => item.url?.startsWith('https://')).map((item) => `<article class="card"><span class="eyebrow">${escapeHtml(item.source)}</span><h3><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a></h3><p>${escapeHtml(item.description)}</p></article>`).join('');
  return entries ? `<section class="section source-list"><span class="eyebrow">PESQUISA E REFERÊNCIAS</span><h2>Fontes para explorar</h2><p>Links encontrados na pesquisa ao vivo. Consulte o conteúdo original antes de publicar informações.</p><div class="cards">${entries}</div></section>` : '';
}

function makeReactFiles(title, prompt, type, html, sources = []) {
  const componentMarkup = `${projectBody(type, title, prompt)}${sourceSectionMarkup(sources)}`;
  const markupLiteral = JSON.stringify(componentMarkup);
  return {
    'src/App.jsx': `import { useEffect } from 'react';

const markup = ${markupLiteral};

export default function App() {
  useEffect(() => {
    let cartCount = 0;
    document.querySelectorAll('.add-cart').forEach((button) => button.addEventListener('click', () => {
      cartCount += 1;
      document.querySelector('#cartCount').textContent = cartCount;
      button.textContent = 'Adicionado';
      setTimeout(() => { button.textContent = 'Adicionar'; }, 900);
    }));
    document.querySelector('#authForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      document.querySelector('#authMessage').textContent = 'Formulário demonstrativo enviado neste navegador.';
    });
  }, []);

  return <main className="generated-app" dangerouslySetInnerHTML={{ __html: markup }} />;
}`,
    'src/main.jsx': `import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\nimport '../styles.css';\n\ncreateRoot(document.getElementById('root')).render(<App />);`,
    'package.json': JSON.stringify({ name: 'projeto-gerado', private: true, version: '1.0.0', type: 'module', scripts: { dev: 'vite', build: 'vite build' }, dependencies: { '@vitejs/plugin-react': 'latest', vite: 'latest', react: 'latest', 'react-dom': 'latest' }, devDependencies: {} }, null, 2),
    'vite.config.js': `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({plugins:[react()]});`,
    'index.html': `<!doctype html>\n<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>`,
    'styles.css': generatedCss() + projectMotionCss,
    'preview.html': html,
    'README.md': `# ${title}\n\nProjeto React criado a partir do pedido: ${prompt}\n\nInstale as dependências e execute 'npm run dev'. A prévia.html mostra a versão HTML do protótipo.`
  };
}

function makeProject(prompt, type, format, sources = []) {
  const title = projectTitle(prompt);
  const body = projectBody(type, title, prompt);
  const navigation = type === 'dashboard' ? '' : `<nav class="site-nav"><a class="brand" href="#">${escapeHtml(title.slice(0, 26))}</a><div class="nav-links"><a href="#sobre">Sobre</a><a href="#contato">Contato</a><a href="#contato">Vamos conversar ↗</a></div></nav>`;
  const html = `<!doctype html>\n<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="theme-color" content="#f5f7f4"><title>${escapeHtml(title)}</title><link rel="stylesheet" href="styles.css"></head><body>${navigation}${body}${sourceSectionMarkup(sources)}<script src="app.js"></script></body></html>`;
  const files = { 'index.html': html, 'styles.css': generatedCss() + projectMotionCss, 'app.js': generatedScript(type) };
  if (format === 'react') Object.assign(files, makeReactFiles(title, prompt, type, html, sources));
  if (format === 'pwa') {
    files['manifest.webmanifest'] = JSON.stringify({ name: title, short_name: title.slice(0, 12), start_url: './', display: 'standalone', background_color: '#f5f7f4', theme_color: '#176b50', icons: [{ src: './icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }] }, null, 2);
    files['icon.svg'] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#176b50"/><path d="M256 100c84 0 152 68 152 152s-68 152-152 152-152-68-152-152 68-152 152-152Z" fill="none" stroke="#fff" stroke-width="24"/><path d="m185 256 48 48 98-104" fill="none" stroke="#fff" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    files['service-worker.js'] = `const CACHE='${escapeHtml(title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}-v1';\nself.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['./','./index.html','./styles.css','./app.js']))));\nself.addEventListener('fetch',event=>event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request))));`;
    files['android/README.md'] = `# Empacotar para Android\n\nEste ZIP contém a interface web instalável (PWA). Para gerar um APK, abra um projeto Android Studio, adicione um WebView e copie os arquivos web para os assets do app. Esta ferramenta não compila nem assina APKs.`;
    files['android/app/src/main/AndroidManifest.xml'] = `<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-permission android:name="android.permission.INTERNET"/><application android:theme="@android:style/Theme.Material.Light.NoActionBar" android:label="${escapeHtml(title.slice(0, 30))}" android:usesCleartextTraffic="false"><activity android:name=".MainActivity" android:exported="true"><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity></application></manifest>`;
    files['android/app/src/main/java/com/prototipo/app/MainActivity.kt'] = `package com.prototipo.app\n\nimport android.app.Activity\nimport android.os.Bundle\nimport android.webkit.WebView\nimport android.webkit.WebViewClient\n\nclass MainActivity : Activity() {\n  override fun onCreate(savedInstanceState: Bundle?) {\n    super.onCreate(savedInstanceState)\n    val webView = WebView(this)\n    webView.settings.javaScriptEnabled = true\n    webView.webViewClient = WebViewClient()\n    setContentView(webView)\n    webView.loadUrl("file:///android_asset/index.html")\n  }\n}`;
    files['index.html'] = html.replace('</head>', '<link rel="icon" href="icon.svg" type="image/svg+xml"><link rel="manifest" href="manifest.webmanifest"></head>').replace('<script src="app.js"></script>', '<script src="app.js"></script><script>if("serviceWorker" in navigator)navigator.serviceWorker.register("service-worker.js")</script>');
    files['android/app/src/main/assets/index.html'] = files['index.html'].replace(/<script>if\("serviceWorker" in navigator\).*?<\/script>/, '');
    files['android/app/src/main/assets/styles.css'] = files['styles.css'];
    files['android/app/src/main/assets/app.js'] = files['app.js'];
  }
  if (!files['README.md']) files['README.md'] = `# ${title}\n\nProjeto criado a partir do pedido: ${prompt}\n\nAbra index.html no navegador. Os formulários e dados de exemplo são locais; não há servidor conectado.`;
  return { files, title, html };
}

function renderFileList() {
  const list = $('#projectFilesList'); list.replaceChildren();
  for (const path of Object.keys(projectFiles)) {
    const button = document.createElement('button'); button.type = 'button';
    button.className = `file-item${path === activeProjectFile ? ' selected' : ''}`;
    button.textContent = path; button.title = path;
    button.addEventListener('click', () => selectProjectFile(path));
    list.append(button);
  }
}

function buildPreview() {
  let html = projectFiles['index.html'] || '';
  if (projectFiles['preview.html'] && html.includes('id="root"')) html = projectFiles['preview.html'];
  const css = projectFiles['styles.css'] || '';
  const js = projectFiles['app.js'] || '';
  html = html.replace(/<link[^>]*href=["']styles\.css["'][^>]*>/i, `<style>${css}</style>`);
  html = html.replace(/<script[^>]*src=["']app\.js["'][^>]*><\/script>/i, `<script>${js}<\/script>`);
  html = html.replace(/<script>if\(["']serviceWorker["'] in navigator\).*?<\/script>/i, '');
  projectPreview.srcdoc = html;
}

function selectProjectFile(path) {
  activeProjectFile = path;
  codeEditor.value = projectFiles[path] || '';
  $('#editorFileName').textContent = path;
  renderFileList();
}

function generateProject() {
  const prompt = builderPrompt.value.trim();
  if (!prompt) { showToast('Descreva o site ou aplicativo que deseja criar.'); builderPrompt.focus(); return; }
  const generated = makeProject(prompt, $('#projectType').value, $('#projectFormat').value, projectResearchContext);
  projectFiles = generated.files;
  renderFileList(); selectProjectFile('index.html'); buildPreview();
  $('#exportZip').disabled = false;
  showToast(`Projeto “${generated.title}” criado como estrutura editável.`);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipProject(files) {
  const encoder = new TextEncoder();
  const localParts = []; const centralParts = [];
  let offset = 0; let centralSize = 0;
  const write16 = (view, position, value) => view.setUint16(position, value, true);
  const write32 = (view, position, value) => view.setUint32(position, value, true);
  for (const [path, value] of Object.entries(files)) {
    const name = encoder.encode(path); const data = encoder.encode(value); const checksum = crc32(data);
    const local = new Uint8Array(30 + name.length); const lv = new DataView(local.buffer);
    write32(lv, 0, 0x04034b50); write16(lv, 4, 20); write16(lv, 6, 0x0800); write16(lv, 8, 0);
    write32(lv, 14, checksum); write32(lv, 18, data.length); write32(lv, 22, data.length); write16(lv, 26, name.length); write16(lv, 28, 0); local.set(name, 30);
    localParts.push(local, data);
    const central = new Uint8Array(46 + name.length); const cv = new DataView(central.buffer);
    write32(cv, 0, 0x02014b50); write16(cv, 4, 20); write16(cv, 6, 20); write16(cv, 8, 0x0800); write16(cv, 10, 0);
    write32(cv, 16, checksum); write32(cv, 20, data.length); write32(cv, 24, data.length); write16(cv, 28, name.length);
    write16(cv, 30, 0); write16(cv, 32, 0); write16(cv, 34, 0); write32(cv, 38, 0); write32(cv, 42, offset); central.set(name, 46);
    centralParts.push(central); centralSize += central.length; offset += local.length + data.length;
  }
  const end = new Uint8Array(22); const ev = new DataView(end.buffer);
  write32(ev, 0, 0x06054b50); write16(ev, 8, centralParts.length); write16(ev, 10, centralParts.length); write32(ev, 12, centralSize); write32(ev, 16, offset); write16(ev, 20, 0);
  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
}

function exportProject() {
  if (!Object.keys(projectFiles).length) return;
  const title = projectTitle(builderPrompt.value || 'projeto').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projeto';
  const url = URL.createObjectURL(zipProject(projectFiles));
  const link = document.createElement('a'); link.href = url; link.download = `${title}.zip`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
$('#researchButton').addEventListener('click', () => openWorkspace(researchOverlay));
$('#webSearchButton').addEventListener('click', () => {
  researchInput.value = input.value.trim();
  openWorkspace(researchOverlay);
  researchInput.focus();
});
researchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = researchForm.querySelector('button[type="submit"]');
  submitButton.disabled = true; submitButton.textContent = 'Pesquisando…';
  try { await runResearch(researchInput.value); }
  catch { researchResults.innerHTML = '<p class="empty-state">Não foi possível consultar as fontes agora. Confira sua conexão e tente novamente.</p>'; }
  finally { submitButton.disabled = false; submitButton.textContent = 'Pesquisar'; }
});
$('#createSiteButton').addEventListener('click', () => {
  projectResearchContext = [];
  $('#builderTitle').textContent = 'Criador de sites';
  $('#builderSubtitle').textContent = 'Descreva sua ideia e gere um projeto editável com prévia.';
  $('#projectType').value = 'landing'; $('#projectFormat').value = 'web';
  openWorkspace(builderOverlay);
});
$('#createAppButton').addEventListener('click', () => {
  projectResearchContext = [];
  $('#builderTitle').textContent = 'Criador de aplicativos';
  $('#builderSubtitle').textContent = 'Gere uma experiência web, um app instalável ou um esqueleto Android.';
  $('#projectType').value = 'login'; $('#projectFormat').value = 'pwa';
  openWorkspace(builderOverlay);
});
$('#generateProject').addEventListener('click', generateProject);
$('#exportZip').addEventListener('click', exportProject);
$('#researchToBuilder').addEventListener('click', () => {
  projectResearchContext = [...lastResearchContext];
  builderPrompt.value = `Crie um projeto sobre “${lastResearchQuery}” usando as informações e referências encontradas. Inclua uma seção de fontes consultadas.`;
  $('#builderTitle').textContent = 'Criar com base na pesquisa';
  $('#builderSubtitle').textContent = 'As referências desta pesquisa serão incluídas no projeto exportado.';
  $('#projectType').value = 'landing'; $('#projectFormat').value = 'web';
  openWorkspace(builderOverlay);
});
codeEditor.addEventListener('input', () => {
  if (!activeProjectFile) return;
  projectFiles[activeProjectFile] = codeEditor.value;
  if (['index.html', 'preview.html', 'styles.css', 'app.js'].includes(activeProjectFile)) buildPreview();
});
document.querySelectorAll('[data-close-workspace]').forEach((button) => button.addEventListener('click', closeWorkspaces));
for (const overlay of [researchOverlay, builderOverlay]) overlay.addEventListener('click', (event) => { if (event.target === overlay) closeWorkspaces(); });
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
$('#planButton').addEventListener('click', (event) => showMenu('plans', event.currentTarget));
$('#profileButton').addEventListener('click', () => showToast('Perfil de demonstração — nenhuma conta conectada.'));
for (const button of document.querySelectorAll('.suggestion')) button.addEventListener('click', () => sendMessage(button.dataset.prompt));
document.addEventListener('click', (event) => {
  if (!popover.hidden && !popover.contains(event.target) && !event.target.closest('#modelSelect, #planButton, #moreButton, #toolsButton')) closePopover();
});
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); newChat(); }
  if (event.key === 'Escape') { closeWorkspaces(); closePopover(); }
});

document.body.classList.toggle('dark', state.dark);
renderModelSelect();
$('#planSummary').textContent = `Plano atual: ${state.plan}`;
$('#profilePlan').textContent = `Plano ${state.plan}`;
renderHistory();
renderChat();
resizeInput();
if (window.innerWidth <= 700) shell.classList.add('sidebar-collapsed');
