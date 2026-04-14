# Local Shell MCP Server — Contexto do Projeto

## O que é isto

Um servidor MCP (Model Context Protocol) local, em Node.js, sem dependências externas. Corre na máquina do Márcio e expõe ferramentas de execução de comandos shell ao Claude (via Claude Desktop / Cowork).

Permite ao Claude executar comandos no terminal do Mac como se fosses tu a fazê-lo — correr scripts, verificar processos, listar ficheiros, etc.

---

## Como funciona

O servidor usa **JSON-RPC 2.0 sobre stdio**. O Claude Desktop lança o processo Node.js e comunica com ele por stdin/stdout. Não precisa de rede nem de instalação de packages npm.

### Configuração ativa (`claude_desktop_config.json`)

```json
"local-shell": {
  "command": "node",
  "args": ["/Users/marciomartins/Documents/Local-shell/shell-server.js"]
}
```

---

## Tools expostos

### `execute_command`
Executa qualquer comando shell e devolve stdout, stderr e exit code.

Parâmetros:
- `command` *(obrigatório)* — o comando a correr (ex: `ls -la`, `python3 script.py`)
- `cwd` — diretório de trabalho (por defeito: home do utilizador)
- `timeout` — timeout em ms (por defeito: 120000; máx: 600000)
- `shell` — shell a usar (por defeito: `$SHELL` ou `/bin/bash`)

### `get_system_info`
Devolve info básica do sistema: OS, arquitetura, hostname, utilizador, shell, memória, etc.

### `http_request`
Faz pedidos HTTP/HTTPS a partir da **máquina local** (não da sandbox do Claude).

Usar automaticamente sempre que uma URL não seja acessível na sandbox — por exemplo:
- `localhost` / `127.0.0.1` ou qualquer porta local
- Redes privadas: `192.168.x.x`, `10.x.x.x`, `172.16–31.x.x`
- Qualquer URL que devolva erro de rede ou "connection refused" na sandbox

Parâmetros:
- `url` *(obrigatório)* — URL completo (ex: `http://localhost:3000/api/health`)
- `method` — método HTTP (GET, POST, PUT, PATCH, DELETE…). Por defeito: `GET`
- `headers` — cabeçalhos como objeto chave/valor (ex: `{"Authorization": "Bearer ..."}`)
- `body` — corpo do pedido como string (para JSON, serializar e definir `Content-Type: application/json`)
- `timeout` — timeout em ms (por defeito: 30000)
- `follow_redirects` — seguir redirects automaticamente (por defeito: `true`)

Implementação: usa `execFileSync('curl', [...args])` — sem dependências npm, zero shell injection.

---

## Repositório

**https://github.com/developermwpt/mcp-local-shell**

Todo o trabalho feito neste projecto é versionado neste repositório. Qualquer alteração a ficheiros deve ser seguida de `git commit` + `git push origin main`. Ver `CLAUDE.md` para o workflow detalhado.

---

## Histórico de desenvolvimento

| Data | Evento |
|------|--------|
| 2026-04-06 | Criado o servidor MCP `shell-server.js` (zero dependências, JSON-RPC sobre stdio) |
| 2026-04-06 | Tentativa de empacotar como plugin Cowork — não funciona (MCP corre na sandbox do Cowork, não no Mac local) |
| 2026-04-06 | Solução: configurar o server diretamente no `claude_desktop_config.json` do Claude Desktop |
| 2026-04-06 | Testado com sucesso — Claude executa comandos reais no Mac (hostname: MacBook-Pro-de-Marcio-2.local) |
| 2026-04-06 | Plugin Cowork desinstalado (removido de `rpm/manifest.json` e pasta apagada) |
| 2026-04-06 | v0.2.0 — adicionada tool `http_request` (curl via execFileSync) para pedidos HTTP/HTTPS a partir da máquina local quando URLs não são acessíveis na sandbox |
| 2026-04-14 | Repositório git criado e publicado em GitHub (`developermwpt/mcp-local-shell`) |
| 2026-04-14 | Adicionados `README.md` (instalação pública) e `CLAUDE.md` (instruções de workflow para o Claude) |

---

## Limitações conhecidas

- **Sem autenticação** — qualquer processo que consiga falar com o Claude Desktop pode usar este tool. Aceitável para uso pessoal.
- **Sem whitelist de comandos** — executa tudo. Intencional (escolha do utilizador).
- **Output máximo: 10 MB** por comando (buffer do `execSync`).
- **Comandos interativos não funcionam** — o servidor usa `execSync`, pelo que comandos que precisem de input do utilizador (ex: `ssh`, `vim`, prompts de password) irão bloquear ou falhar. Ver secção "Melhorias futuras".

---

## Melhorias futuras sugeridas

### 1. Suporte a comandos long-running / streaming
Substituir `execSync` por `spawn` com streaming de output linha a linha. Permitiria acompanhar logs em tempo real.

```js
// Em vez de execSync, usar spawn com eventos 'data'
const child = spawn(shell, ['-c', command], { cwd, env });
child.stdout.on('data', chunk => { /* stream de output */ });
```

### 2. Tool `run_script`
Um tool dedicado para correr ficheiros de script (`.py`, `.sh`, `.js`) pelo caminho — com deteção automática do interpretador.

### 3. Tool `list_processes` / `kill_process`
Listar processos em execução e terminar processos pelo PID — útil para gestão de serviços locais.

### 4. Tool `watch_file`
Monitorizar um ficheiro de log e devolver as últimas N linhas (tipo `tail -f`).

### 5. Histórico de comandos
Guardar log de todos os comandos executados (com timestamp, exit code e output) num ficheiro local para auditoria.

### 6. Variáveis de ambiente configuráveis
Permitir passar `env vars` adicionais por comando, sem expor as globais do sistema.

### 7. Streaming de output para `http_request`
Para respostas grandes (ex: download de ficheiros), fazer streaming em vez de esperar pela resposta completa em memória.

---

## Estrutura do projecto

```
mcp-local-shell/
├── shell-server.js     ← servidor MCP (zero dependências)
├── CLAUDE.md           ← instruções de workflow para o Claude
├── CONTEXTO.md         ← este ficheiro (contexto técnico e histórico)
└── README.md           ← documentação pública (instalação, uso)
```

---

## Referências

- [Model Context Protocol — especificação](https://spec.modelcontextprotocol.io)
- [MCP SDK (Node.js)](https://github.com/modelcontextprotocol/typescript-sdk) — não usado aqui (implementação manual para zero deps)
- Configuração do Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json`
