const MODEL_IDS = {
  'Astra 6': 'claude-sonnet-5-5',
  'Luna 6': 'claude-haiku-5-5',
  'Orion 5': 'claude-opus-5-5',
  'Vega 5': 'claude-fable-5-2'
};

const EFFORTS = {
  Baixo: 'low',
  'Médio': 'medium',
  Alto: 'high',
  Máximo: 'max'
};

const requestsByIp = new Map();
const MAX_REQUESTS_PER_MINUTE = 12;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 6000;
const MAX_TOTAL_LENGTH = 24000;

function isAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  if (origin === `${protocol}://${host}` || origin === `https://${host}`) return true;
  const extraOrigins = (process.env.APP_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
  return extraOrigins.includes(origin);
}

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (requestsByIp.get(ip) || []).filter((time) => now - time < 60_000);
  if (recent.length >= MAX_REQUESTS_PER_MINUTE) return true;
  recent.push(now);
  requestsByIp.set(ip, recent);
  return false;
}

function wantsWebSearch(messages) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content || '';
  return /\b(pesquis[ae]|na internet|fonte[s]?|not[ií]cia[s]?|atualizado|mais recente|pre[cç]o|cot[aã]c[aã]o|documenta[cç][aã]o oficial|hoje|agora)\b/i.test(lastUserMessage);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Origin');

  if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'Origem não autorizada.' });
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'A chave privada do Claude ainda não foi configurada no servidor.' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Muitas mensagens em pouco tempo. Tente novamente em um minuto.' });

  const body = req.body || {};
  const model = MODEL_IDS[body.model] || MODEL_IDS['Astra 6'];
  const effort = EFFORTS[body.effort] || 'medium';
  if (!Array.isArray(body.messages)) return res.status(400).json({ error: 'Envie uma conversa válida.' });

  let totalLength = 0;
  const messages = body.messages.slice(-MAX_MESSAGES).map((message) => {
    if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string') return null;
    const content = message.content.trim().slice(0, MAX_MESSAGE_LENGTH);
    totalLength += content.length;
    return { role: message.role, content };
  }).filter(Boolean);
  if (!messages.length || totalLength > MAX_TOTAL_LENGTH) return res.status(400).json({ error: 'A conversa está vazia ou excede o limite permitido.' });

  const payload = {
    model,
    system: 'Você é um assistente inteligente que conversa em português brasileiro. Interprete a intenção e o contexto, mesmo com erros de digitação, mensagens informais e frases incompletas. Responda diretamente e de forma concisa, normalmente em até três frases. Para pedidos de programação, forneça soluções utilizáveis, explique decisões importantes e aponte limitações. Se a ambiguidade impedir uma resposta correta, faça uma pergunta curta. Nunca invente fatos ou fontes.',
    messages,
    max_tokens: 8192,
    output_config: { effort },
    thinking: { type: 'adaptive' }
  };
  if (wantsWebSearch(messages)) payload.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4, user_location: { type: 'approximate', country: 'BR', timezone: 'America/Sao_Paulo' } }];

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45_000)
    });
    const result = await response.json();
    if (!response.ok) {
      const status = response.status === 401 || response.status === 403 ? 503 : response.status === 429 ? 429 : 502;
      return res.status(status).json({ error: status === 429 ? 'A IA está ocupada ou atingiu o limite de uso. Tente novamente mais tarde.' : 'A IA não conseguiu responder agora. Verifique a configuração do serviço e tente novamente.' });
    }

    const text = (result.content || []).filter((part) => part.type === 'text').map((part) => part.text || '').join('\n').trim();
    const sources = (result.content || [])
      .flatMap((part) => [...(part.citations || []), ...(Array.isArray(part.content) ? part.content : [])])
      .filter((citation) => citation.url && (citation.title || citation.type === 'web_search_result'))
      .map((citation) => ({ title: citation.title || citation.url, url: citation.url }))
      .filter((source, index, all) => all.findIndex((item) => item.url === source.url) === index)
      .slice(0, 5);

    if (!text) return res.status(502).json({ error: 'A IA retornou uma resposta vazia. Tente novamente.' });
    return res.status(200).json({ text, sources });
  } catch {
    return res.status(502).json({ error: 'Não foi possível conectar à IA agora. Tente novamente.' });
  }
};
