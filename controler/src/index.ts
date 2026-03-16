import { createClient } from "redis";
import blessed from "blessed";
import contrib from "blessed-contrib";
const redis = createClient({ url: "redis://127.0.0.1:6379" });
const pub = redis.duplicate();

await Promise.all([redis.connect(), pub.connect()]);

const screen = blessed.screen();
const grid = new contrib.grid({ rows: 12, cols: 12, screen });
const line = grid.set(0, 0, 8, 12, contrib.line, {
  label: " Cluster Latency P99 (ms) ",
  style: { line: "yellow" },
});

screen.render();

screen.key(["q", "C-c"], () => {
  return process.exit(0);
});
