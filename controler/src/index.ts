import { createClient } from "redis";
import blessed from "blessed";
import contrib from "blessed-contrib";
import { REDIS_KEYS } from "../../shared/protocol.js";

const screen = blessed.screen({
  smartCSR: true,
  title: "Valkyrie C2",
  fullUnicode: true,
});

const grid = new contrib.grid({ rows: 12, cols: 12, screen });

const line = grid.set(0, 0, 6, 8, contrib.line, {
  label: " Latency P99 (ms) ",
  showLegend: true,
  style: { line: "yellow", text: "white", baseline: "black" },
  xLabelPadding: 3,
  xPadding: 5,
});

const bar = grid.set(0, 8, 6, 4, contrib.bar, {
  label: " Status Codes ",
  barWidth: 6,
  barSpacing: 4,
  xOffset: 2,
  maxHeight: 100,
  style: { bg: "black" },
});

const spark = grid.set(6, 0, 2, 12, contrib.sparkline, {
  label: " Throughput (Requests/sec) ",
  tags: true,
  style: { fg: "cyan" },
});

const log = grid.set(8, 0, 4, 12, contrib.log, {
  label: " System Events ",
  fg: "white",
  tags: true,
  scrollable: true,
  scrollbar: { ch: " ", track: { bg: "black" }, style: { inverse: true } },
});

let concurrency = 10;
const latencyHistory = {
  title: "P99",
  x: [] as string[],
  y: [] as number[],
  style: { line: "yellow" },
};
let rawLatencies: number[] = [];
let rpsHistory: number[] = Array(40).fill(0);
let reqCount = 0;
const statuses = { "2xx": 0, "5xx": 0 };

setInterval(() => {
  rpsHistory.push(reqCount);
  if (rpsHistory.length > 80) rpsHistory.shift();

  spark.setData(["RPS"], [rpsHistory]);

  bar.setData({
    titles: ["2xx", "5xx"],
    data: [statuses["2xx"], statuses["5xx"]],
  });

  reqCount = 0;
  screen.render();
}, 1000);

async function boot() {
  const redis = createClient({ url: "redis://127.0.0.1:6379" });
  const pub = redis.duplicate();

  redis.on("error", (err) =>
    log.log(`{red-fg}[REDIS ERROR]{/red-fg} ${err.message}`),
  );

  await Promise.all([redis.connect(), pub.connect()]);
  log.log(`{green-fg}[SYSTEM]{/green-fg} Connected to Valkyrie Message Broker`);

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
      `{cyan-fg}[ACTION]{/cyan-fg} Broadcasted ${type} (Concurrency: ${concurrency})`,
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
  screen.key(["q", "C-c"], async () => {
    log.log(`{yellow-fg}[SYSTEM]{/yellow-fg} Shutting down C2...`);
    await Promise.all([redis.quit(), pub.quit()]);
    process.exit(0);
  });

  try {
    await redis.xGroupCreate(
      REDIS_KEYS.TELEMETRY_STREAM,
      REDIS_KEYS.GROUP_NAME,
      "0",
      { MKSTREAM: true },
    );
  } catch (e: any) {
    if (!e.message.includes("BUSYGROUP")) {
      log.log(`{red-fg}[STREAM ERROR]{/red-fg} ${e.message}`);
    }
  }

  log.log(
    `{green-fg}[SYSTEM]{/green-fg} Awaiting telemetry on ${REDIS_KEYS.TELEMETRY_STREAM}...`,
  );
  screen.render();

  while (true) {
    try {
      const data = await redis.xReadGroup(
        REDIS_KEYS.GROUP_NAME,
        "c1",
        [{ key: REDIS_KEYS.TELEMETRY_STREAM, id: ">" }],
        { COUNT: 500, BLOCK: 100 },
      );

      if (data && data.length > 0 && data[0].messages.length > 0) {
        const messages = data[0].messages;
        const messageIds: string[] = [];

        messages.forEach((m) => {
          messageIds.push(m.id);
          const p = m.message;
          reqCount++;

          if (p.status && p.status.startsWith("2")) {
            statuses["2xx"]++;
          } else if (p.status && p.status.startsWith("5")) {
            statuses["5xx"]++;
          }

          if (p.latency) {
            const lat = parseFloat(p.latency);
            if (!isNaN(lat)) {
              rawLatencies.push(lat);
              if (rawLatencies.length > 2000) rawLatencies.shift();
            }
          }
        });

        await redis.xAck(
          REDIS_KEYS.TELEMETRY_STREAM,
          REDIS_KEYS.GROUP_NAME,
          messageIds,
        );

        if (rawLatencies.length > 0) {
          const sorted = [...rawLatencies].sort((a, b) => a - b);
          const p99Index = Math.max(0, Math.ceil(sorted.length * 0.99) - 1);
          const p99 = sorted[p99Index] || 0;

          latencyHistory.y.push(p99);
          const now = new Date();
          latencyHistory.x.push(
            `${now.getMinutes()}:${now.getSeconds().toString().padStart(2, "0")}`,
          );

          if (latencyHistory.y.length > 30) {
            latencyHistory.y.shift();
            latencyHistory.x.shift();
          }

          line.setData([latencyHistory]);
        }
      }
    } catch (err: any) {
      log.log(`{red-fg}[LOOP ERROR]{/red-fg} ${err.message}`);
      await new Promise((res) => setTimeout(res, 1000));
    }
  }
}

boot().catch((err) => {
  console.error(err);
  process.exit(1);
});
