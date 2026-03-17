import { createClient } from "redis";
import { createClient } from "redis";
import blessed from "blessed";
import contrib from "blessed-contrib";
import { REDIS_KEYS } from "../../shared/protocol.js";

const screen = blessed.screen({ smartCSR: true, title: "Valkyrie C2" });
const grid = new contrib.grid({ rows: 12, cols: 12, screen });

const line = grid.set(0, 0, 6, 8, contrib.line, {
  label: " Latency P99 (ms) ",
  showLegend: true,
  style: { line: "yellow" },
});
const bar = grid.set(0, 8, 6, 4, contrib.bar, {
  label: " Status Codes ",
  barWidth: 4,
  barSpacing: 6,
  maxHeight: 100,
});
const spark = grid.set(6, 0, 2, 12, contrib.sparkline, {
  label: " Throughput (Requests/sec) ",
  style: { fg: "cyan" },
});
const log = grid.set(8, 0, 4, 12, contrib.log, { label: " System Events " });

let concurrency = 10;
const latencyHistory = { title: "P99", x: [] as string[], y: [] as number[] };
let rawLatencies: number[] = [];
let rpsHistory: number[] = [0];
let reqCount = 0;
const statuses = { "2xx": 0, "5xx": 0 };

setInterval(() => {
  rpsHistory.push(reqCount);
  if (rpsHistory.length > 40) rpsHistory.shift();
  spark.setData(["RPS"], [rpsHistory]);
  reqCount = 0;
  screen.render();
}, 1000);

async function boot() {
  const redis = createClient({ url: "redis://127.0.0.1:6379" });
  const pub = redis.duplicate();
  await Promise.all([redis.connect(), pub.connect()]);

  const send = (type: string) => {
    pub.publish(
      REDIS_KEYS.COMMAND_CHANNEL,
      JSON.stringify({
        type,
        config: {
          targetUrl: "http://localhost:3000",
          concurrency,
          duration: 60,
          method: "GET",
        },
      }),
    );
    log.log(
      `{cyan-fg}[ACTION]{/cyan-fg} Sent ${type} (Concurrency: ${concurrency})`,
    );
  };

  screen.key(["s"], () => send("START"));
  screen.key(["up"], () => {
    concurrency += 10;
    send("UPDATE");
  });
  screen.key(["down"], () => {
    if (concurrency > 10) concurrency -= 10;
    send("UPDATE");
  });
  screen.key(["q", "C-c"], () => process.exit(0));

  try {
    await redis.xGroupCreate(
      REDIS_KEYS.TELEMETRY_STREAM,
      REDIS_KEYS.GROUP_NAME,
      "0",
      { MKSTREAM: true },
    );
  } catch (e) {}

  while (true) {
    const data = await redis.xReadGroup(
      REDIS_KEYS.GROUP_NAME,
      "c1",
      { key: REDIS_KEYS.TELEMETRY_STREAM, id: ">" },
      { COUNT: 100, BLOCK: 100 },
    );
    if (data) {
      data[0].messages.forEach((m) => {
        const p = m.message;
        reqCount++;

        p.status.startsWith("2") ? statuses["2xx"]++ : statuses["5xx"]++;
        bar.setData({
          titles: ["2xx", "Err"],
          data: [statuses["2xx"], statuses["5xx"]],
        });

        const lat = parseFloat(p.latency);
        rawLatencies.push(lat);
        if (rawLatencies.length > 500) rawLatencies.shift();

        const sorted = [...rawLatencies].sort((a, b) => a - b);
        const p99 = sorted[Math.ceil(sorted.length * 0.99) - 1];

        latencyHistory.y.push(p99);
        latencyHistory.x.push(
          new Date(parseInt(p.ts)).toLocaleTimeString().slice(-5),
        );
        if (latencyHistory.y.length > 20) {
          latencyHistory.y.shift();
          latencyHistory.x.shift();
        }

        line.setData([latencyHistory]);
      });
      screen.render();
    }
  }
}

boot().catch(console.error);
