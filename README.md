#!/bin/bash

# VALKYRIE README GENERATOR
# Run this script to create/overwrite the project documentation.

cat << 'EOF' > README.md
# VALKYRIE: Distributed Systems Command & Control (C2)

Valkyrie is an advanced, high-concurrency load orchestration framework designed for systems engineers. It utilizes a decoupled Controller-Worker architecture to execute large-scale traffic generation while providing real-time telemetry, sub-millisecond performance analytics, and dynamic intensity adjustment via a centralized Terminal User Interface (TUI).

---

## 1. System Architecture

The project is built on the principle of distributed state management, leveraging Redis as a high-throughput message bus.

### 1.1 The Control Plane (Controller)
The Controller operates as the cluster's brain, providing a visual dashboard built with the `blessed-contrib` engine.
* **Command Broadcasting:** Utilizes Redis Pub/Sub to send global synchronization signals (START, UPDATE, STOP).
* **Telemetry Aggregation:** Consumes atomic events from Redis Streams, processing them in batches to calculate cluster-wide P99 latencies.

### 1.2 The Data Plane (Worker)
Workers are stateless, high-performance agents capable of scaling horizontally across multiple nodes.
* **Asynchronous Lanes:** Employs non-blocking HTTP workers to saturate target bandwidth.
* **Precision Reporting:** Captures high-resolution timing data using the `performance` API and ships JSON-serialized telemetry to the broker.

### 1.3 The Transport Layer (Redis)
* **Streams:** Provides a persistent buffer for telemetry, ensuring data integrity even if the Controller experiences temporary processing lag.
* **Consumer Groups:** Enables the system to scale telemetry processing across multiple dashboard instances if required.

---

## 2. Technical Specifications

### 2.1 Performance Analytics
* **P99 Latency:** Calculated via a rolling-window sorting algorithm to identify the 99th percentile, providing an accurate view of system tail-latency.
* **Throughput (RPS):** Real-time tracking of successful requests per second across the entire cluster.
* **Status Distribution:** Real-time categorical analysis of HTTP response codes (2xx, 4xx, 5xx).

### 2.2 Stack Overview
* **Runtime:** Node.js (ES Modules)
* **Language:** TypeScript
* **Communication:** Redis (Streams & Pub/Sub)
* **UI Engine:** Blessed / Blessed-contrib
* **Containerization:** Podman / Docker (Alpine-based)

---

## 3. Security & Configuration

The system follows a strict configuration-driven approach. Sensitive infrastructure details are never hardcoded in the source logic.

### Environment Variables
The following variables must be set in the execution environment:
* `VALKYRIE_REDIS_URL`: The connection string for the Redis broker.
* `VALKYRIE_TARGET_URL`: The designated endpoint for load operations.

---

## 4. Deployment & Operation

### 4.1 Infrastructure Reset
To ensure a clean state, purge existing containers and re-deploy the broker:

```bash
# Environment Cleanup
podman stop valkyrie-broker valkyrie-target 2>/dev/null
podman rm valkyrie-broker valkyrie-target 2>/dev/null

# Infrastructure Deployment
podman run -d --name valkyrie-broker -p 6379:6379 redis:alpine
