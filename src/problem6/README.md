# 1. Module Overview

**Name:** `score-service` (logical module within API service)  
**Purpose:**
- Authoritatively update user scores when an action is completed.
- Expose a real-time top‑10 leaderboard.
- Block or detect unauthorized/malicious score increments.

---

# 2. Assumptions & Constraints

- All requests come over HTTPS with a valid **Bearer JWT**.
- Client cannot send the new score directly, only “action completion” events.
- Each action maps to a deterministic score delta on the server.
- Real-time updates delivered via WebSocket (SSE fallback optional).
- Redis is available for caching and real-time leaderboard (sorted set).
- PostgreSQL (or equivalent RDBMS) is the source of truth for score history.
- High write frequency is expected (actions), but leaderboard reads are ~10x higher.
- (Optional) An API Gateway is in front of the service for auth, rate limit, and routing.

---

# 3. Definitions

- **Action Event**: A user-triggered event representing completion of a unit of work.
- **Score Delta**: Points awarded for a specific action type. Stored server-side.
- **Idempotency Key**: Unique client-generated key ensuring an action is not processed twice.
- **Nonce**: One-time token to prevent replay attacks (optional if idempotency key is robust).
- **Canonical String**: Deterministic string built from request parts to sign with HMAC.

---

# 4. Functional Requirements

## 4.1 Score Update

1. **Receive event**: `POST /v1/actions/complete` with `actionType`, `actionId`, `idempotencyKey`, timestamp, optional signed payload.
2. **Authenticate & authorize**: Validate JWT (`sub=userId`, `scope:score.write`).
3. **Validate idempotency/replay**:
   - Reject duplicates by checking `Idempotency-Key` in Redis/DB (TTL 24h). On duplicate: return the original 200 response (preferred) or 409 (policy decision).
   - Optional HMAC verification using a server-issued session secret + timestamp (±30s drift) + nonce (TTL 60s).
4. **Compute delta**: Lookup action type → score delta in server config/table.
5. **Persist event & score**:
   - Insert row into `score_events`.
   - Update `user_scores.total_score` using optimistic locking/version column.
6. **Publish event**: Emit `score.updated` to the message bus for real-time push & analytics.
7. **Return response**: New total score, rank, and (optionally) a top‑10 snapshot.

## 4.2 Leaderboard Retrieval

1. **Top 10 endpoint**: `GET /v1/leaderboard/top?limit=10`.
2. **Real-time feed**:
   - WebSocket channel `/ws/leaderboard` (rooms: `leaderboard:global`, `user:<id>`).
   - Server broadcasts on score change (debounced ≤ 1–2s).

## 4.3 Security & Abuse Prevention

1. Require JWT; validate signature, expiry, audience, scopes.
2. Enforce rate limits (per user / per IP).
3. Require idempotency key per action.
4. Optional HMAC signature with nonce + timestamp (canonicalization required).
5. Audit log every score change (append-only table or immutable log store).
6. Periodic anomaly detection job (external module/hook).

## 4.4 Observability

- **Logs**: request ID, user ID, action ID, delta, old/new score, latency, result (OK/ERR). Avoid logging sensitive PII.
- **Metrics**:
  - `score_update_latency_ms` (histogram)
  - `score_updates_total` (counter)
  - `score_rejected_total{reason}` (counter)
  - `leaderboard_pushes_total` (counter)
  - (Optional) broker consumer lag, Redis latency
- **Tracing**: OpenTelemetry spans for DB writes, cache ops, message publish.

---

# 5. Non-Functional Requirements

| Category        | Requirement                                                                   |
|-----------------|-------------------------------------------------------------------------------|
| Availability    | 99.9% monthly SLA                                                             |
| Scalability     | ~1k updates/s sustained, ~10k read/s on leaderboard                           |
| Consistency     | Eventual for leaderboard (≤ 2 s), Strong for user score in DB                 |
| Security        | JWT + RBAC; optional HMAC-signed payload; OWASP API Top 10 mitigations        |
| Maintainability | Code coverage ≥ 80%; API versioning strategy (`v1`, `v2`, …)                  |
| Auditability    | All mutations logged & immutable (WORM/append-only or external log store)     |
| Privacy         | GDPR-ready: minimal PII in logs, retention policies defined                   |

---

# 6. API Contracts

## 6.1 POST `/v1/actions/complete`

**Headers**

* `Authorization: Bearer <JWT>`
* `Idempotency-Key: <uuid>` (required)
* `X-Signature: <hmac>` (optional if using payload signing)

**Body (JSON)**

```json
{
  "actionId": "a9eb0c1f-1234-4cdd-9e48-9b0ac31f0a2e",
  "actionType": "QUIZ_FINISHED",
  "timestamp": "2025-07-24T02:35:12Z",
  "clientNonce": "k3jd9s2...", 
  "metadata": { "difficulty": "hard" }
}
```

**Response 200**

```json
{
  "userId": "u_123",
  "newScore": 1530,
  "scoreDelta": 20,
  "rank": 7,
  "leaderboard": [
    { "userId": "u_891", "score": 2550 },
    ...
  ],
  "processedAt": "2025-07-24T02:35:12.845Z"
}
```

**Error Responses**

| Code | Reason                         | Body example                                                             |
| ---- | ------------------------------ | ------------------------------------------------------------------------ |
| 400  | Validation error/duplicate key | `{ "error":"IDEMPOTENT_REPLAY", "message":"Duplicate Idempotency-Key" }` |
| 401  | Invalid/expired JWT            | `{ "error":"UNAUTHENTICATED" }`                                          |
| 403  | Missing scope/role             | `{ "error":"UNAUTHORIZED" }`                                             |
| 429  | Rate limit exceeded            | `{ "error":"RATE_LIMIT" }`                                               |
| 500  | Internal error                 | `{ "error":"INTERNAL", "requestId":"..." }`                              |

---

## 6.2 GET `/v1/leaderboard/top`

**Query Params**: `limit` (1–50, default 10)

**Response 200**

```json
{
  "limit": 10,
  "generatedAt": "2025-07-24T02:36:00Z",
  "entries": [
    { "userId": "u_891", "score": 2550 },
    { "userId": "u_007", "score": 2500 }
  ]
}
```

---

## 6.3 WebSocket `/ws/leaderboard`

**Handshake**: JWT in `Authorization` header.
**Message Types**:

```json
// Server → Client
{ "type": "leaderboard.update", "entries":[ ... ], "generatedAt": "..." }

// Client → Server (optional ping)
{ "type": "ping" }
```

**Close Codes**: 4001 (unauthorized), 4002 (rate limit), 4003 (protocol violation).

---

# 7. Data Model (Relational Example)

```sql
-- Users (not owned by this module but referenced)
CREATE TABLE users (
  id           VARCHAR(64) PRIMARY KEY,
  created_at   TIMESTAMP NOT NULL,
  ...          -- other user fields
);

CREATE TABLE user_scores (
  user_id      VARCHAR(64) PRIMARY KEY REFERENCES users(id),
  total_score  BIGINT NOT NULL DEFAULT 0,
  version      INT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE score_events (
  id              UUID PRIMARY KEY,
  user_id         VARCHAR(64) NOT NULL REFERENCES users(id),
  action_id       VARCHAR(128) NOT NULL,
  action_type     VARCHAR(64) NOT NULL,
  score_delta     INT NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT now(),
  idempotency_key VARCHAR(128) NOT NULL,
  UNIQUE (idempotency_key),
  UNIQUE (action_id, user_id)
);

-- Optional table for action scoring rules
CREATE TABLE action_score_rules (
  action_type   VARCHAR(64) PRIMARY KEY,
  score_delta   INT NOT NULL,
  max_per_day   INT NULL     -- to enforce per-day caps
);
```

**Cache Structures** (Redis):

* `leaderboard:zset` → sorted set (`score`, `userId`)
* `idem:<idempotencyKey>` → value `<userId>` TTL 24h
* `nonce:<clientNonce>` → true TTL 60s (if using nonces)

---

# 8. Processing Flow

### 8.1 Sequence (ASCII)

```
Client ----POST /actions/complete----> API Gateway ----> score-service
  |                                              |
  |                             Validate JWT, rate-limit
  |                                              |
  |                             Check Idempotency / Nonce
  |                                              |
  |                             Lookup delta for actionType
  |                                              |
  |                             Begin Tx: insert score_event
  |                               update user_scores (version++)
  |                             Commit Tx
  |                                              |
  |                             Publish score.updated event
  |                                              |
  |<----200 newScore, rank, leaderboard snapshot-|
            |
            └--- WebSocket push (if connected) --->
```

---

### 9. Realtime in a Multi-Node Setup: How to Push to the Right User?

**Don’t try to “ask which node the user is on.” Use a broker/adapter instead.**

---

#### 9.1 Pattern 1 – Pub/Sub Adapter (Initial Recommendation)

* Use Redis Pub/Sub, NATS, or a ready-made adapter (e.g., Socket.IO Redis adapter).
* Every node subscribes to the same channel.
* When you publish `score.updated` with key `user:123`, whichever node is holding that user’s socket will emit to the client.
* Simple, scales well, quick to implement.

**Diagram:**

```
Score Service -> Publish("user.123", payload) -> Redis / NATS
         Node A, B, C all subscribe
         Node B has user 123’s socket -> emit to client
```

---

#### 9.2 Pattern 2 – Presence Map + Node Targeting

* On connect, write a mapping `{ userId -> socketIds, nodeId }` to Redis.
* When pushing: look up Redis, group socketIds by node, and send an RPC to each specific node.
* More complex, but saves internal broadcast bandwidth.

---

#### 9.3 Pattern 3 – Dedicated WebSocket Gateway

* Stand up a dedicated WS Gateway cluster.
* The API service only publishes events to a broker; the Gateway pushes to clients.
* Lets you scale and optimize WebSockets independently.

---

# 10. Security Requirements (Detailed)

* **JWT validation**:

  * Signature (RS256), `exp`, `iat`, `aud` check.
  * Claims: `sub` (user ID), `scope` should include `score.write` for updates.
* **Idempotency**:

  * Caller must generate a GUID per action completion.
  * Server stores key to reject duplicates.
* **Replay & Tampering**:

  * Optional: `X-Signature` = HMAC(secret, canonicalized\_body + timestamp).
  * Reject if timestamp drift > 30s and nonce reused.
* **Rate Limiting**:

  * `X` updates/user/minute, `Y`/IP/minute configured in API Gateway.
* **Input Validation**:

  * `actionType` in allowlist (defined by `action_score_rules`).
  * `score_delta` never accepted from client.
* **RBAC**:

  * Only user themselves can update their score; `userId` taken from token.
* **Transport**: TLS 1.2+, HSTS, no downgrade.
* **Audit Trail**:

  * Append-only table or external log store (e.g., CloudTrail, Loki) capturing before/after scores.

---

# 11. Error Handling & Idempotency Rules

* Duplicate `idempotencyKey` → HTTP 409 (or 400) with explicit error.
* If DB commit fails after event insert, rollback and delete cache keys.
* Idempotent endpoint: Re-sending same key returns same result payload.

---

# 12. Caching & Leaderboard Strategy

* Use Redis Sorted Set for leaderboard.
* On each successful score update:

  * Update `ZINCRBY leaderboard:zset <delta> <userId>`.
* Periodically (e.g., every 5 minutes), reconcile Redis with DB to prevent drift.
* Eviction & Persistence: snapshot to disk / AOF for crash recovery, plus nightly full DB rebuild.

---

# 13. Observability & Alerting

* **Logs**: JSON structured; include `requestId`, `userId`, `actionId`.
* **Metrics**: Prometheus/Datadog exporters.
* **Alerts**:

  * High error rate (>2% 5-min window).
  * Sudden spike in score updates (>3x baseline).
  * Redis latency/evictions.

---

# 14. Testing Strategy

## 14.1 Unit Tests

* Delta calculation by action type.
* JWT parsing & scope validation.
* Idempotency key enforcement.

## 14.2 Integration Tests

* Full API call → DB transaction → Redis update → event publish.
* Concurrency test: 50 simultaneous updates for same user (verify version increment).
* WebSocket stream correctness after update.

## 14.3 Security Tests

* Replay attack simulation.
* Payload tampering (remove fields, change userId).
* Rate-limit bypass attempts.

## 14.4 Load/Perf Tests

* Benchmark P95/P99 latencies with 1k RPS.
* Redis leaderboard read under 10k concurrent subscribers.

---

# 15. Deployment & Config

**Env Vars (examples)**

| Variable                    | Description                           |
| --------------------------- | ------------------------------------- |
| `JWT_ISSUER`                | Expected issuer                       |
| `JWT_AUDIENCE`              | Expected audience                     |
| `HMAC_SECRET`               | Secret for payload signing (optional) |
| `REDIS_URL`                 | Redis connection                      |
| `DB_URL`                    | Postgres DSN                          |
| `RATE_LIMIT_USER_PER_MIN`   | e.g., 60                              |
| `RATE_LIMIT_IP_PER_MIN`     | e.g., 200                             |
| `LEADERBOARD_PUSH_INTERVAL` | debounce time for broadcast (ms)      |

**CI/CD:**

* Run unit + integration tests.
* Static analysis (SonarQube, ESLint/TSLint if TS).
* Container image signed (Cosign), SBOM attached.
* Use Feature Flag

---

# 16. Versioning & Migration

* **API Versioning:** URI‑based (`/v1/`, `/v2/`).
* **DB Migrations:** Use Prisma.

---

# 17. Future Enhancements

* Pluggable fraud scoring engine (ML-based anomaly detection).
* Support for segmented leaderboards (e.g., weekly, country-specific).
* Action batching endpoint to reduce request overhead.
* Signed WebSocket JWT refresh (for long-lived sockets).

---