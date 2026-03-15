import axios, { AxiosInstance } from "axios";

export class LoadEngine {
  private active = false;
  private http: AxiosInstance = axios.create({
    timeout: 5000,
    validateStatus: () => true,
  });
}
