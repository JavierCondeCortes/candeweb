import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const isWindows = process.platform === 'win32';
const candidates = isWindows
  ? [
      process.env.CHROME_PATH,
      process.env.EDGE_PATH,
      join(process.env.PROGRAMFILES ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(process.env['PROGRAMFILES(X86)'] ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(process.env.PROGRAMFILES ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      join(
        process.env['PROGRAMFILES(X86)'] ?? '',
        'Microsoft',
        'Edge',
        'Application',
        'msedge.exe',
      ),
      join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ]
  : [
      process.env.CHROME_PATH,
      process.env.EDGE_PATH,
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/microsoft-edge',
      '/usr/bin/microsoft-edge-stable',
    ];

const browserPath = candidates.find((candidate) => candidate && existsSync(candidate));

if (!browserPath) {
  console.error(
    'Chrome DevTools MCP necesita un navegador Chromium. Instala Chrome/Edge o define CHROME_PATH o EDGE_PATH.',
  );
  process.exit(1);
}

const args = [
  '-y',
  'chrome-devtools-mcp@latest',
  '--executablePath',
  browserPath,
  '--headless',
  '--isolated',
  '--no-usage-statistics',
];

const npxCli = [
  join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js'),
  join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'npm', 'bin', 'npx-cli.js'),
].find((candidate) => candidate && existsSync(candidate));
const command = npxCli ? process.execPath : isWindows ? 'npx.cmd' : 'npx';
const commandArgs = npxCli ? [npxCli, ...args] : args;

const child = spawn(command, commandArgs, {
  env: process.env,
  shell: false,
  stdio: 'inherit',
  windowsHide: true,
});

child.once('error', (error) => {
  console.error(`No se ha podido iniciar Chrome DevTools MCP: ${error.message}`);
  process.exitCode = 1;
});

child.once('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}
