/**
 * Standalone worker process. Run via `pnpm --filter @workspace/api-server run start:worker`.
 * The API enqueues jobs; this process consumes them. Both share the same Postgres
 * via DATABASE_URL — pg-boss handles distributed locking.
 */
import http from "node:http";
import { logger } from "./lib/logger";
import { getBoss } from "./lib/queue";
import { registerWorkers, registerSchedules } from "./lib/worker";

async function main(): Promise<void> {
  logger.info("CtrlTrade® worker process starting");
  await getBoss();
  await registerWorkers();
  await registerSchedules();
  logger.info("Worker process ready — consuming jobs");

  // Tiny health endpoint so the platform can probe liveness.
  // PORT may be unset (console-output workflow) or collide with the API; degrade gracefully.
  const port = Number(process.env["PORT"] ?? 0);
  const server = http.createServer((req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, role: "worker" }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  server.on("error", (err: NodeJS.ErrnoException) => {
    logger.warn({ err: err.message, code: err.code }, "Worker health endpoint disabled");
  });
  server.listen(port, () => {
    const addr = server.address();
    const bound = typeof addr === "object" && addr ? addr.port : port;
    logger.info({ port: bound }, "Worker health endpoint listening");
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Worker shutting down");
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "Worker fatal");
  process.exit(1);
});
