import { AxiosInstance } from "axios";
import {TelemetryEvent} from "../../shared/protocol.js"
export class LoadEngine {
  private active = false;
  private http: AxiosInstance;

    constructor(private nodeId : string , private onReport :(data :TelemetryEvent ))
}
