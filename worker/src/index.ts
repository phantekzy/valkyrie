import { createClient } from "redis";

const nodeId = `node-${Math.random().toString(36).slice(2, 6)}`;
const redis = createClient({ url: "redis://127.0.0.1:6379" });
const pub = redis.duplicate();
