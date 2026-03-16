import { createClient } from "redis";
import blessed from "blessed";
const redis = createClient({ url: "redis://127.0.0.1:6379" });
const pub = redis.duplicate();

await Promise.all([redis.connect(), pub.connect()]);

const screen = blessed.screen();
