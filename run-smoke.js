/**
 * Start server, wait, run CLI smoke test, then kill server.
 * From repo root: node run-smoke.js (after npm install + server built)
 */
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverDir = join(__dirname, "server");
const cliDir = join(__dirname, "cli");

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const SMOKE_PORT = 18765;
async function run() {
  const server = spawn("node", ["dist/ws-server.js"], {
    cwd: serverDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(SMOKE_PORT) },
  });
  let serverClosed = false;
  server.on("error", (err) => {
    if (!serverClosed) console.error("Server failed to start:", err);
  });
  server.stderr?.on("data", (d) => process.stderr.write(d));
  server.stdout?.on("data", (d) => process.stdout.write(d));

  await sleep(2000);
  if (server.exitCode != null && server.exitCode !== 0) {
    console.error("Server exited early");
    process.exit(1);
  }

  const cli = spawn("node", ["smoke-test.js"], {
    cwd: cliDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, TCG_SERVER: `ws://localhost:${SMOKE_PORT}` },
  });
  cli.stdout?.on("data", (d) => process.stdout.write(d));
  cli.stderr?.on("data", (d) => process.stderr.write(d));
  const cliDone = new Promise((resolve) => cli.on("close", resolve));
  await cliDone;
  server.kill();
  serverClosed = true;
  process.exit(cli.exitCode ?? 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
