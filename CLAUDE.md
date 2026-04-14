# Instruções do projecto — mcp-local-shell

## Objectivo
Desenvolvimento e manutenção do servidor MCP local (`shell-server.js`) que expõe ferramentas de shell, HTTP e sistema ao Claude Desktop / Cowork.

## Repositório remoto
**https://github.com/developermwpt/mcp-local-shell**

Todo o trabalho feito neste projecto deve reflectir-se no repositório. Esta é uma regra sem excepções.

## Workflow obrigatório com git

Sempre que forem feitas alterações a qualquer ficheiro do projecto (código, documentação, configuração), o fluxo é:

1. Fazer as alterações
2. `git add` nos ficheiros modificados
3. `git commit` com mensagem descritiva (seguir convenção abaixo)
4. `git push origin main`

Nunca terminar uma sessão de trabalho sem confirmar que o repositório remoto está actualizado.

## Convenção de mensagens de commit

Usar prefixos semânticos:

| Prefixo | Quando usar |
|---|---|
| `feat:` | nova funcionalidade ou nova tool |
| `fix:` | correcção de bug |
| `docs:` | alterações a README, CONTEXTO, CLAUDE.md |
| `refactor:` | reestruturação de código sem mudança de comportamento |
| `chore:` | tarefas de manutenção (config, dependências) |

Exemplo: `feat: add watch_file tool with tail -f support`

## Estrutura do projecto

```
mcp-local-shell/
├── shell-server.js     ← servidor MCP (zero dependências)
├── CLAUDE.md           ← este ficheiro (instruções para o Claude)
├── CONTEXTO.md         ← contexto técnico detalhado e histórico
├── README.md           ← documentação pública (instalação, uso)
└── SESSAO_*.md         ← notas de sessões anteriores (não commitar novas)
```

## Regras adicionais

- O ficheiro `SESSAO_*.md` serve de notas de sessão internas. Não é necessário criar novos a cada sessão — actualizar o `CONTEXTO.md` com o histórico relevante.
- Antes de qualquer alteração ao `shell-server.js`, verificar a versão actual no topo do ficheiro (`SERVER_INFO.version`) e incrementar se a mudança for significativa.
- O servidor não tem dependências npm. Manter assim — não adicionar `package.json` nem `node_modules`.
