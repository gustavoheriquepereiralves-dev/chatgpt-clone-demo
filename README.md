# Protótipo local de chat

Uma interface de conversa em português inspirada no fluxo geral do ChatGPT. Os arquivos foram criados como um protótipo independente, com layout responsivo, conversas salvas localmente no navegador, tema claro/escuro e respostas demonstrativas.

## Abrir

Abra `index.html` em um navegador moderno. Não há instalação nem servidor necessários.

## Limites desta versão

- A conversa reconhece cumprimentos, agradecimentos e despedidas sem pesquisar esses textos. Perguntas consultam Wikipedia em português e inglês ao vivo, e projetos públicos do GitHub quando o assunto é tecnologia; a resposta mostra trechos das fontes e links. Não há modelo de IA conectado para interpretação livre.
- Astra 6, Luna 6, Orion 5 e Vega 5 são nomes demonstrativos. Os níveis de esforço e os planos Free, Plus, Pro e Team são apenas controles visuais, sem cobrança ou recursos reais.
- A tela de pesquisa ao vivo consulta Wikipedia em português e inglês e projetos públicos do GitHub em paralelo; também oferece links para buscadores externos.
- O criador gera modelos HTML/CSS/JavaScript, inclui arquivos de exemplo para React e PWA/Android WebView, permite editar e pré-visualizar e exporta um ZIP. Os projetos são scaffolds demonstrativos; não há geração livre por IA, backend, login real nem compilação de APK.
- Voz, anexos, biblioteca, compartilhamento de conversas e conta continuam demonstrativos.
- O histórico fica no armazenamento local deste navegador. Use **Limpar conversas** no menu para removê-lo.

## Como foi analisado

O REA tentou observar `https://chatgpt.com/` em uma sessão isolada de Chromium. O site apresentou uma página de verificação do Cloudflare, portanto a interface autenticada e o comportamento interno não puderam ser inspecionados. O protótipo usa decisões próprias de apresentação e cobre somente o fluxo visível pretendido, sem copiar código ou dados da aplicação original.
