#!/usr/bin/env node

/**
 * Local Shell MCP Server
 *
 * A zero-dependency MCP (Model Context Protocol) server that exposes
 * shell command execution and HTTP requests over stdio using JSON-RPC 2.0.
 *
 * Tools exposed:
 *   - execute_command : Run any shell command and get stdout/stderr/exit code
 *   - get_system_info : Return basic OS/system info
 *   - http_request    : Make HTTP/HTTPS requests from the local machine
 *                       (useful when URLs are not reachable from the Claude sandbox)
 */

const { execSync, execFileSync } = require('child_process');
const os = require('os');

// ─── JSON-RPC helpers ────────────────────────────────────────────────

function jsonrpcResponse(id, result) {
  return JSON.stringify({ jsonrpc: '2.0', id, result });
}

function jsonrpcError(id, code, message, data) {
  const err = { code, message };
  if (data !== undefined) err.data = data;
  return JSON.stringify({ jsonrpc: '2.0', id, error: err });
}

// ─── MCP Protocol constants ──────────────────────────────────────────

const SERVER_INFO = {
  name: 'local-shell',
  version: '0.2.0',
};

const CAPABILITIES = {
  tools: {},
};

const TOOLS = [
  {
    name: 'execute_command',
    description:
      'Execute a shell command on the local machine. Returns stdout, stderr, and exit code. ' +
      'Supports any command the user\'s default shell can run (bash/zsh). ' +
      'Commands run in the user\'s home directory by default — use the `cwd` parameter to change.',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute (e.g. "ls -la", "python3 script.py", "docker ps")',
        },
        cwd: {
          type: 'string',
          description: 'Working directory for the command. Defaults to user home directory.',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds. Defaults to 120000 (2 minutes). Max 600000 (10 minutes).',
        },
        shell: {
          type: 'string',
          description: 'Shell to use (e.g. "/bin/bash", "/bin/zsh"). Defaults to the system default shell.',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'get_system_info',
    description:
      'Get basic system information: OS, architecture, hostname, shell, home directory, and current user.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'http_request',
    description:
      'Make an HTTP or HTTPS request from the LOCAL machine (not the Claude sandbox). ' +
      'Use this automatically whenever a URL is not reachable from the sandbox — for example: ' +
      'localhost / 127.0.0.1, private/internal network addresses (192.168.x.x, 10.x.x.x, 172.16-31.x.x), ' +
      'URLs that returned a network error or connection-refused in the sandbox, ' +
      'or any service running on the user\'s own machine or local network. ' +
      'Returns HTTP status code, response headers, and the full response body.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Full URL to request (e.g. "http://localhost:3000/api/health")',
        },
        method: {
          type: 'string',
          description: 'HTTP method: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS. Defaults to GET.',
        },
        headers: {
          type: 'object',
          description: 'Request headers as key/value pairs (e.g. {"Authorization": "Bearer token", "Content-Type": "application/json"})',
          additionalProperties: { type: 'string' },
        },
        body: {
          type: 'string',
          description: 'Request body as a string. For JSON payloads pass the serialised JSON string and set Content-Type: application/json.',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds. Defaults to 120000 (2 minutes). Only override if the user explicitly requests a different value.',
        },
        follow_redirects: {
          type: 'boolean',
          description: 'Follow HTTP redirects automatically. Defaults to true.',
        },
      },
      required: ['url'],
    },
  },
];

// ─── Tool handlers ───────────────────────────────────────────────────

function handleExecuteCommand(args) {
  const command = args.command;
  if (!command || typeof command !== 'string') {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Error: "command" parameter is required and must be a string.' }],
    };
  }

  const cwd = args.cwd || os.homedir();
  const timeout = Math.min(args.timeout || 120000, 600000);
  const shell = args.shell || process.env.SHELL || '/bin/bash';

  try {
    const stdout = execSync(command, {
      cwd,
      timeout,
      shell,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10 MB
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return {
      content: [
        {
          type: 'text',
          text: [
            `$ ${command}`,
            `[cwd: ${cwd}]`,
            `[exit code: 0]`,
            '',
            stdout || '(no output)',
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    const exitCode = err.status !== undefined ? err.status : 1;
    const stdout = err.stdout || '';
    const stderr = err.stderr || '';
    const timedOut = err.killed;

    const parts = [`$ ${command}`, `[cwd: ${cwd}]`];
    if (timedOut) parts.push(`[TIMED OUT after ${timeout}ms]`);
    parts.push(`[exit code: ${exitCode}]`, '');

    if (stdout) { parts.push('--- stdout ---'); parts.push(stdout); }
    if (stderr) { parts.push('--- stderr ---'); parts.push(stderr); }
    if (!stdout && !stderr) parts.push(err.message || '(no output)');

    return {
      isError: exitCode !== 0,
      content: [{ type: 'text', text: parts.join('\n') }],
    };
  }
}

function handleGetSystemInfo() {
  const info = {
    os: `${os.type()} ${os.release()} (${os.platform()})`,
    arch: os.arch(),
    hostname: os.hostname(),
    user: os.userInfo().username,
    home: os.homedir(),
    shell: process.env.SHELL || 'unknown',
    node: process.version,
    cpus: os.cpus().length,
    memory: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))} GB`,
    uptime: `${Math.round(os.uptime() / 3600)} hours`,
  };

  return {
    content: [
      {
        type: 'text',
        text: Object.entries(info).map(([k, v]) => `${k}: ${v}`).join('\n'),
      },
    ],
  };
}

function handleHttpRequest(args) {
  const {
    url,
    method = 'GET',
    headers = {},
    body,
    timeout = 120000,
    follow_redirects = true,
  } = args;

  if (!url || typeof url !== 'string') {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Error: "url" parameter is required and must be a string.' }],
    };
  }

  // Build curl argument list (avoids shell-injection issues)
  const curlArgs = [
    '--silent',
    '--include',                           // include response headers in output
    '--max-time', String(Math.ceil(timeout / 1000)),
    '--request', (method || 'GET').toUpperCase(),
  ];

  if (follow_redirects !== false) {
    curlArgs.push('--location', '--max-redirs', '10');
  }

  // Headers
  const hdrs = headers && typeof headers === 'object' ? headers : {};
  for (const [k, v] of Object.entries(hdrs)) {
    curlArgs.push('--header', `${k}: ${v}`);
  }

  // Body
  if (body !== undefined && body !== null) {
    curlArgs.push('--data-raw', String(body));
  }

  curlArgs.push(url);

  try {
    const raw = execFileSync('curl', curlArgs, {
      timeout: timeout + 5000,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });

    // Split headers from body on first blank line (handles HTTP/1.1 + redirects)
    // curl --include may produce multiple header blocks when following redirects
    // We want the LAST header block
    const blocks = raw.split(/\r?\n\r?\n/);
    let lastHeaderBlock = '';
    let responseBody = '';

    // Find last HTTP/... header block
    let headerBlockIdx = -1;
    for (let i = 0; i < blocks.length; i++) {
      if (/^HTTP\//i.test(blocks[i].trimStart())) {
        headerBlockIdx = i;
      }
    }

    if (headerBlockIdx !== -1) {
      lastHeaderBlock = blocks[headerBlockIdx];
      responseBody = blocks.slice(headerBlockIdx + 1).join('\n\n');
    } else {
      responseBody = raw;
    }

    const headerLines = lastHeaderBlock.split(/\r?\n/);
    const statusLine = headerLines[0] || '(unknown status)';
    const responseHeaders = headerLines.slice(1).filter(Boolean).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: [
            `URL:    ${url}`,
            `Method: ${(method || 'GET').toUpperCase()}`,
            `Status: ${statusLine}`,
            '',
            '--- Response Headers ---',
            responseHeaders || '(none)',
            '',
            '--- Response Body ---',
            responseBody.trim() || '(empty)',
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    const exitCode = err.status !== undefined ? err.status : 1;
    const stderr = (err.stderr || '').trim();
    const stdout = (err.stdout || '').trim();

    // curl exit code meanings (most common)
    const curlErrors = {
      6: 'Could not resolve host (DNS failure)',
      7: 'Failed to connect to host (connection refused or host unreachable)',
      28: 'Operation timed out',
      35: 'SSL/TLS handshake failed',
      52: 'Empty reply from server',
      56: 'Failure receiving network data',
    };
    const hint = curlErrors[exitCode] ? ` — ${curlErrors[exitCode]}` : '';

    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: [
            `HTTP request failed`,
            `URL:       ${url}`,
            `Method:    ${(method || 'GET').toUpperCase()}`,
            `curl exit: ${exitCode}${hint}`,
            stderr ? `\nError details:\n${stderr}` : '',
            stdout ? `\nPartial output:\n${stdout}` : '',
          ].filter(Boolean).join('\n'),
        },
      ],
    };
  }
}

// ─── Request dispatcher ──────────────────────────────────────────────

function handleRequest(msg) {
  const { id, method, params } = msg;

  switch (method) {
    case 'initialize':
      return jsonrpcResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: CAPABILITIES,
        serverInfo: SERVER_INFO,
      });

    case 'notifications/initialized':
      return null;

    case 'ping':
      return jsonrpcResponse(id, {});

    case 'tools/list':
      return jsonrpcResponse(id, { tools: TOOLS });

    case 'tools/call': {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      let result;
      switch (toolName) {
        case 'execute_command':
          result = handleExecuteCommand(toolArgs);
          break;
        case 'get_system_info':
          result = handleGetSystemInfo();
          break;
        case 'http_request':
          result = handleHttpRequest(toolArgs);
          break;
        default:
          return jsonrpcError(id, -32602, `Unknown tool: ${toolName}`);
      }
      return jsonrpcResponse(id, result);
    }

    default:
      if (id !== undefined && id !== null) {
        return jsonrpcError(id, -32601, `Method not found: ${method}`);
      }
      return null;
  }
}

// ─── stdio transport ─────────────────────────────────────────────────

let buffer = '';

process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;

  while (true) {
    const newlineIdx = buffer.indexOf('\n');
    if (newlineIdx === -1) break;

    const line = buffer.slice(0, newlineIdx).trim();
    buffer = buffer.slice(newlineIdx + 1);

    if (!line) continue;

    try {
      const msg = JSON.parse(line);
      const response = handleRequest(msg);
      if (response) process.stdout.write(response + '\n');
    } catch (err) {
      const errResp = jsonrpcError(null, -32700, 'Parse error', err.message);
      process.stdout.write(errResp + '\n');
    }
  }
});

process.stdin.on('end', () => process.exit(0));

process.on('uncaughtException', (err) => {
  process.stderr.write(`[local-shell] Uncaught exception: ${err.message}\n`);
});

process.on('unhandledRejection', (err) => {
  process.stderr.write(`[local-shell] Unhandled rejection: ${err}\n`);
});
