# Protótipo local de chat

Uma interface de conversa em português inspirada no fluxo geral do ChatGPT. Os arquivos foram criados como um protótipo independente, com layout responsivo, conversas salvas localmente no navegador, tema claro/escuro e respostas demonstrativas.

## Abrir

Abra `index.html` em um navegador moderno. Não há instalação nem servidor necessários.

## Limites desta versão

- As respostas são exemplos locais; nenhum modelo de IA ou serviço online está conectado.
- Pesquisa na web, voz, anexos, projetos, biblioteca, compartilhamento de conversas e conta são itens visuais demonstrativos.
- O histórico fica no armazenamento local deste navegador. Use **Limpar conversas** no menu para removê-lo.

## Como foi analisado

O REA tentou observar `https://chatgpt.com/` em uma sessão isolada de Chromium. O site apresentou uma página de verificação do Cloudflare, portanto a interface autenticada e o comportamento interno não puderam ser inspecionados. O protótipo usa decisões próprias de apresentação e cobre somente o fluxo visível pretendido, sem copiar código ou dados da aplicação original.
