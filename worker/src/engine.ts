import axios, { AxiosInstance } from "axios";
import { AttackConfig } from "../../shared/protocol.js";

export class LoadEngine {
  private active = false;
  private http: AxiosInstance = axios.create({
    timeout: 5000,
    validateStatus: () => true,
  });

  constructor(
    private nodeId: string,
    private onReport: (status: number, latency: number) => Promise<void>,
  ) {}

  async start(config: AttackConfig) {
    this.active = true;
    const lanes = Array.from({ length: config.concurrency }).map(async () => {
      while (this.active) {
        const start = performance.now();
        try {
          const res = await this.http({
            method: config.method,
            url: config.targetUrl,
          });
          await this.onReport(res.status, performance.now() - start);
        } catch (err) {
          await this.onReport(504, 5000);
        }
        await new Promise((r) => setImmediate(r));
      }
    });
    await Promise.all(lanes);
  }

  stop() {
    this.active = false;
  }
}
