# mcp-local-shell

Um servidor MCP (*Model Context Protocol*) minimalista, sem dependências, que expõe execução de comandos shell, pedidos HTTP e informação do sistema directamente à IA — a partir da tua máquina local.

Funciona com Claude Desktop, Claude Code e qualquer cliente compatível com MCP over stdio.

---

## O que faz

| Ferramenta | Descrição |
|---|---|
| `execute_command` | Executa qualquer comando shell na tua máquina e devolve stdout, stderr e exit code |
| `get_system_info` | Devolve informação básica do sistema (OS, CPU, memória, shell, utilizador) |
| `http_request` | Faz pedidos HTTP/HTTPS a partir da tua máquina local — útil para aceder a `localhost`, redes privadas ou URLs bloqueadas no sandbox da IA |

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) v18 ou superior (sem dependências adicionais)
- Claude Desktop ou qualquer cliente MCP compatível com stdio

---

## Instalação

### 1. Clonar o repositório

```bash
git clone https://github.com/developermwpt/mcp-local-shell.git
cd mcp-local-shell
```

Não é necessário `npm install` — o servidor não tem dependências externas.

### 2. Tornar o servidor executável (macOS / Linux)

```bash
chmod +x shell-server.js
```

### 3. Registar no Claude Desktop

Edita o ficheiro de configuração do Claude Desktop:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Adiciona a seguinte entrada dentro do objecto `mcpServers`:

```json
{
  "mcpServers": {
    "local-shell": {
      "command": "node",
      "args": ["/caminho/absoluto/para/mcp-local-shell/shell-server.js"]
    }
  }
}
```

Substitui `/caminho/absoluto/para/mcp-local-shell/` pelo caminho real na tua máquina. Exemplo macOS:

```json
{
  "mcpServers": {
    "local-shell": {
      "command": "node",
      "args": ["/Users/teu-utilizador/Documents/mcp-local-shell/shell-server.js"]
    }
  }
}
```

### 4. Reiniciar o Claude Desktop

Fecha e volta a abrir o Claude Desktop. O servidor `local-shell` deve aparecer como ferramenta disponível.

---

## Registar no Claude Code (CLI)

```bash
claude mcp add local-shell node /caminho/absoluto/para/mcp-local-shell/shell-server.js
```

Para verificar se está activo:

```bash
claude mcp list
```

---

## Testar manualmente

Podes testar o servidor directamente no terminal antes de o ligar ao Claude:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node shell-server.js
```

Deverá devolver a lista das três ferramentas em formato JSON.

---

## Exemplos de uso no Claude

Uma vez instalado, podes pedir ao Claude:

- *"Executa `git status` na pasta ~/Documents/projeto"*
- *"Qual é a informação do meu sistema?"*
- *"Faz um GET a http://localhost:3000/api/health e mostra a resposta"*
- *"Lista os processos a correr com `ps aux | grep node`"*

---

## Segurança

Este servidor executa comandos shell com as permissões do utilizador que o corre. Usa-o apenas em ambientes controlados e com clientes MCP de confiança. Não o exponhas em redes públicas.

---

## Licença

MIT
