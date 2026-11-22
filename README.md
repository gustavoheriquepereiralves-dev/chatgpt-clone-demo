# Protótipo local de chat

Uma interface de conversa em português com integração opcional ao Claude, pesquisa na web, conversas salvas localmente no navegador e um criador de projetos demonstrativo.

## Abrir

O site estático abre como demonstração visual. Para usar o chat com Claude, publique este repositório na Vercel e configure a chave secreta conforme a seção abaixo.

## Recursos e limites

- A conversa usa Claude pela Messages API quando o servidor estiver configurado. Pesquisas de notícias e informações atuais podem usar a busca web do Claude, com fontes.
- Astra 6, Luna 6, Orion 5 e Vega 5 são atalhos do protótipo para modelos Claude reais. O perfil de programação usa Claude Opus 5.5 e esforço máximo; pedidos de programação ativam esse perfil automaticamente.
- A tela de pesquisa ao vivo consulta Wikipedia em português e inglês e projetos públicos do GitHub em paralelo; também oferece links para buscadores externos.
- O criador gera modelos HTML/CSS/JavaScript, inclui arquivos de exemplo para React e PWA/Android WebView, permite editar e pré-visualizar e exporta um ZIP. Os projetos são scaffolds demonstrativos; não há geração livre por IA, backend, login real nem compilação de APK.
- Voz, anexos, biblioteca, compartilhamento de conversas e conta continuam demonstrativos.
- O histórico fica no armazenamento local deste navegador. Use **Limpar conversas** no menu para removê-lo.

## Publicar com a IA conectada

O GitHub Pages publica somente os arquivos estáticos deste site. Para ativar o Claude, importe o repositório na Vercel e adicione `ANTHROPIC_API_KEY` como variável secreta do projeto. A chave não deve ser colocada em arquivos do site nem enviada em mensagens. Configure um limite de gastos na conta Anthropic e faça um novo deploy depois de adicionar a variável.

A API Anthropic é cobrada conforme o uso. Mensagens enviadas ao assistente são processadas pelo serviço Claude.

## Como foi analisado

O REA tentou observar `https://chatgpt.com/` em uma sessão isolada de Chromium. O site apresentou uma página de verificação do Cloudflare, portanto a interface autenticada e o comportamento interno não puderam ser inspecionados. O protótipo usa decisões próprias de apresentação e cobre somente o fluxo visível pretendido, sem copiar código ou dados da aplicação original.
