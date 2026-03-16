import axios from "axios";
import { AxiosInstance } from "axios";

export class LoadEngine {
  private active = false;
  private http: AxiosInstance = axios.create({
    timeout: 5000,
    validateStatus: () => true,
  });

  constructor(
    private nodeId: string,
    private onReport: (data: any) => Promise<void>,
  ) {}

  async start(config: any) {
    this.active = true;
    const end = Date.now() + config.duration * 1000;
    const lanes = Array.from({ length: config.concurrency }).map(async () => {
      while (this.active && Date.now() < end) {
        const start = performance.now();
        try {
        } catch {
          await this.onReport({
            nodeId: this.nodeId,
            status: 500,
            latency: 5000,
            ts: Date.now(),
          });
        }
      }
    });
  }
}
