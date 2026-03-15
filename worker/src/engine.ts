import axios, { AxiosInstance } from "axios";

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
  }
}
