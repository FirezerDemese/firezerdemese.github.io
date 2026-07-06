/* FlowLens dashboard.
 *
 * Runs in two modes from the same file:
 *   server mode (default) — polls the FastAPI JSON endpoints
 *   demo mode  (window.FLOWLENS_DEMO = true) — a fully client-side simulation
 *     of the Write-Audit-Publish engine, so the dashboard can be hosted as a
 *     static site with no SQL Server behind it. Same UI, same data shapes.
 */
const DEMO = !!window.FLOWLENS_DEMO;
const REFRESH_MS = 4000;

/* ========================================================== demo engine === */
const demo = (() => {
    if (!DEMO) return null;

    const DAY = 86400000;
    const now = () => new Date();
    const iso = (d) => d.toISOString();
    const batchIdFor = (date) =>
        "D" + date.toISOString().slice(0, 10).replace(/-/g, "");

    const CONTRACTS = [
        { id: 1, schema_name: "dbo", table_name: "FactConsumption", column_name: null, rule_type: "freshness", status: "approved", confidence: 0.97, rationale: "Batches have arrived on a strict daily cadence for 8 consecutive days; a gap beyond 1 day breaks the expected freshness window." },
        { id: 2, schema_name: "dbo", table_name: "FactConsumption", column_name: null, rule_type: "row_volume", status: "approved", confidence: 0.94, rationale: "Daily volume is tightly clustered around ~48,000 rows (2,000 meters × 24 hourly readings); a deviation beyond 15% signals silent row loss or duplication." },
        { id: 3, schema_name: "dbo", table_name: "FactConsumption", column_name: "kwh", rule_type: "value_range", status: "approved", confidence: 0.91, rationale: "Observed kWh readings span 0.02–9.8 across the profiling window; values outside [0, 12] would indicate sensor faults or unit errors." },
        { id: 4, schema_name: "dbo", table_name: "FactConsumption", column_name: "meter_id", rule_type: "not_null", status: "approved", confidence: 0.99, rationale: "meter_id was non-null in 100% of 384,000 profiled rows and is the join key to DimMeter — a null here orphans the reading." },
        { id: 5, schema_name: "dbo", table_name: "FactConsumption", column_name: "reading_ts", rule_type: "not_null", status: "approved", confidence: 0.99, rationale: "Every profiled row carried a reading timestamp; a null would make the reading unusable for time-series aggregation." },
        { id: 6, schema_name: "dbo", table_name: "FactConsumption", column_name: "voltage", rule_type: "value_range", status: "approved", confidence: 0.88, rationale: "Voltage clusters at 220–245V with ~2% nulls allowed; readings outside [180, 260] suggest meter malfunction rather than real grid state." },
        { id: 7, schema_name: "dbo", table_name: "FactConsumption", column_name: "meter_id", rule_type: "unique", status: "proposed", confidence: 0.72, rationale: "meter_id + reading_ts pairs were unique in the profiling window; proposed as a composite-key guard but needs a human to confirm intent." },
    ];

    function seed() {
        const runs = [];
        // 8 days of clean history ending "yesterday"
        for (let i = 8; i >= 1; i--) {
            const started = new Date(now().getTime() - i * DAY);
            started.setHours(2, 10, 0, 0);
            const finished = new Date(started.getTime() + 3200 + Math.random() * 900);
            runs.push({
                id: 9 - i,
                batch_id: batchIdFor(started),
                verdict: "pass",
                published: true,
                quarantined: false,
                started_at: iso(started),
                finished_at: iso(finished),
                summary: "Published 48000 rows to dbo.FactConsumption.",
            });
        }
        return {
            runs,
            contracts: JSON.parse(JSON.stringify(CONTRACTS)),
            incidents: [],
            evidence: {},   // incident_id -> [evidence blocks]
            nextRunId: 9,
            nextIncidentId: 1,
            dayOffset: 0,
        };
    }

    // State survives page navigation (dashboard -> incident.html) via
    // sessionStorage, so the incident report you just created is really there.
    const STORE_KEY = "flowlens-demo-state-v1";

    function load() {
        try {
            const raw = sessionStorage.getItem(STORE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }

    function save() {
        try { sessionStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* private mode */ }
    }

    let state = load() || seed();

    const latency = (ms) => new Promise((r) => setTimeout(r, ms));

    function nextBatchId() {
        state.dayOffset += 1;
        return batchIdFor(new Date(now().getTime() + state.dayOffset * DAY - DAY));
    }

    function healthScore() {
        const recent = state.runs.slice(-20);
        if (!recent.length) return 100.0;
        return Math.round((100 * recent.filter((r) => r.verdict === "pass").length) / recent.length * 10) / 10;
    }

    function apiHealth() {
        const passCount = state.runs.filter((r) => r.verdict === "pass").length;
        const failCount = state.runs.filter((r) => r.verdict === "fail").length;
        const last = state.runs[state.runs.length - 1] || null;
        const latencies = state.runs.map((r) =>
            new Date(r.finished_at) - new Date(r.started_at));
        const avg = latencies.length
            ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length * 10) / 10
            : null;
        return {
            health_score: healthScore(),
            healthy_count: passCount,
            quarantined_count: failCount,
            total_runs: state.runs.length,
            last_run: last ? { batch_id: last.batch_id, verdict: last.verdict, started_at: last.started_at, finished_at: last.finished_at } : null,
            contracts_auto_generated: state.contracts.length,
            incidents_open: state.incidents.filter((i) => i.status === "open").length,
            avg_detection_latency_ms: avg,
            bad_batches_prevented: failCount,
            prevention_rate_pct: failCount > 0 ? 100.0 : null,
        };
    }

    async function runBatch(kind) {
        await latency(2600 + Math.random() * 700); // audit gate "runs"
        const batch_id = nextBatchId();
        const started = new Date(now().getTime() - 3400);
        const finished = new Date(started.getTime() + 3100 + Math.random() * 700);

        if (kind === "good") {
            state.runs.push({
                id: state.nextRunId++,
                batch_id, verdict: "pass", published: true, quarantined: false,
                started_at: iso(started), finished_at: iso(finished),
                summary: "Published 48000 rows to dbo.FactConsumption.",
            });
            save();
            return { batch_id, verdict: "pass" };
        }

        // bad batch: the join silently drops ~38% of rows -> gate refuses to publish
        const missing = 743 + Math.floor(Math.random() * 40);
        const diffPct = (37.1 + Math.random() * 2.3).toFixed(2);
        const qRows = 48000 + Math.floor(Math.random() * 120);
        const reason = `contract checks failed: ['row_volume:None']; reconciliation diff ${diffPct}% exceeds tolerance (${missing} meters missing)`;
        state.runs.push({
            id: state.nextRunId++,
            batch_id, verdict: "fail", published: false, quarantined: true,
            started_at: iso(started), finished_at: iso(finished),
            summary: `Quarantined ${qRows} rows. Reason: ${reason}`,
        });

        const incidentId = state.nextIncidentId++;
        const targetRows = Math.round(qRows * (1 - diffPct / 100));
        state.incidents.push({
            id: incidentId,
            batch_id,
            severity: "high",
            title: `Batch ${batch_id} quarantined at audit gate`,
            status: "open",
            confidence: 0.92,
            created_at: iso(now()),
            root_cause_ai:
                `The load procedure for batch ${batch_id} used an INNER JOIN to dbo.DimMeter with an is_active filter, silently dropping every reading from meters not yet marked active — ${missing} meters, about ${diffPct}% of the batch. The procedure itself completed without errors and would have logged 'Succeeded'; only the audit gate's reconciliation caught the row loss before publish.`,
            downstream_impact:
                `Had this batch published, dbo.FactConsumption would be missing ~${qRows - targetRows} readings for the day. Every consumption aggregate, regional rollup, and billing calculation downstream would silently under-report — with no failed job to alert anyone.`,
            recommended_action:
                `Fix the join in staging.usp_LoadMeterBatch_BAD to LEFT JOIN (or remove the is_active filter), re-run batch ${batch_id} from quarantine, and verify reconciliation passes. The quarantined rows are intact in quarantine.FactConsumption_Quarantine.`,
        });

        state.evidence[incidentId] = [
            {
                evidence_type: "failed_checks",
                evidence_json: JSON.stringify([
                    { check_type: "contract", target: "row_volume:None", detail: `row count ${targetRows} outside tolerance of baseline 48000 ±15%` },
                    { check_type: "reconciliation", target: "source_vs_target", detail: `diff=${diffPct}%, missing_meters=${missing}` },
                ]),
            },
            {
                evidence_type: "passed_checks",
                evidence_json: JSON.stringify([
                    { check_type: "contract", target: "freshness:None" },
                    { check_type: "contract", target: "value_range:kwh" },
                    { check_type: "contract", target: "not_null:meter_id" },
                    { check_type: "contract", target: "not_null:reading_ts" },
                    { check_type: "contract", target: "value_range:voltage" },
                ]),
            },
            {
                evidence_type: "recon_diff",
                evidence_json: JSON.stringify({
                    source_rows: qRows, target_rows: targetRows,
                    diff_pct: Number(diffPct),
                    source_sum: 118430.7, target_sum: 73298.4, passed: false,
                }),
            },
            {
                evidence_type: "missing_meters",
                evidence_json: JSON.stringify({
                    count: missing,
                    sample: ["MTR-01204", "MTR-01381", "MTR-01422", "MTR-01573", "MTR-01688", "MTR-01764", "MTR-01822", "MTR-01907", "MTR-01955", "MTR-01998"],
                }),
            },
            {
                evidence_type: "baseline_delta",
                evidence_json: JSON.stringify({ expected_row_count: 48000, actual_row_count: targetRows }),
            },
            {
                evidence_type: "run_log",
                evidence_json: JSON.stringify({
                    candidate_proc: "staging.usp_LoadMeterBatch_BAD",
                    note: "Audit gate evaluated this proc's join logic against a preview before publish; the proc was never executed against production because the preview failed audit.",
                }),
            },
        ];
        save();
        return { batch_id, verdict: "fail", incident_id: incidentId };
    }

    return {
        async get(url) {
            await latency(120 + Math.random() * 180);
            if (url === "/api/health-score") return apiHealth();
            if (url === "/api/runs") return [...state.runs].reverse().slice(0, 25);
            if (url === "/api/contracts") return [...state.contracts].reverse();
            if (url === "/api/incidents") return [...state.incidents].reverse();
            const m = url.match(/^\/api\/incidents\/(\d+)$/);
            if (m) {
                const id = Number(m[1]);
                return {
                    incident: state.incidents.find((i) => i.id === id) || null,
                    evidence: state.evidence[id] || [],
                };
            }
            throw new Error("demo: unknown GET " + url);
        },
        async post(url) {
            if (url === "/api/run/good") return runBatch("good");
            if (url === "/api/run/bad") return runBatch("bad");
            if (url === "/api/reset") { await latency(600); state = seed(); save(); return { ok: true }; }
            let m = url.match(/^\/api\/contracts\/(\d+)\/(approve|reject)$/);
            if (m) {
                await latency(250);
                const c = state.contracts.find((x) => x.id === Number(m[1]));
                if (c) c.status = m[2] === "approve" ? "approved" : "rejected";
                save();
                return { ok: true };
            }
            throw new Error("demo: unknown POST " + url);
        },
    };
})();

/* ========================================================== transport ==== */
async function getJSON(url) {
    if (DEMO) return demo.get(url);
    const res = await fetch(url);
    return res.json();
}

async function postJSON(url) {
    if (DEMO) return demo.post(url);
    const res = await fetch(url, { method: "POST" });
    return res.json();
}

/* ============================================================ helpers ==== */
function fmtTime(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(undefined, {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
}

function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function badge(text, cls) {
    return `<span class="badge badge-${cls}">${esc(text)}</span>`;
}

function toast(msg, kind = "") {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.className = "toast show " + kind;
    clearTimeout(toast._h);
    toast._h = setTimeout(() => t.classList.remove("show"), 3400);
}

function incidentHref(id) {
    return DEMO ? `incident.html?id=${id}` : `/incidents/${id}`;
}

/* ================================================== pipeline animation === */
const pipeline = {
    el: () => document.getElementById("pipeline"),
    start() {
        const p = this.el(); if (!p) return;
        p.classList.add("running");
        p.querySelectorAll(".pipe-node").forEach((n) => n.classList.remove("active", "flash"));
        p.querySelectorAll(".pipe-check .dot").forEach((d) => (d.className = "dot"));
        p.querySelector('[data-stage="write"]').classList.add("active");
        this._t1 = setTimeout(() => {
            p.querySelector('[data-stage="write"]').classList.remove("active");
            const audit = p.querySelector('[data-stage="audit"]');
            audit.classList.add("active");
            ["contracts", "recon", "anomaly"].forEach((c, i) => {
                setTimeout(() => {
                    const dot = p.querySelector(`[data-check="${c}"]`);
                    if (dot && p.classList.contains("running")) dot.classList.add("checking");
                }, i * 350);
            });
        }, 700);
    },
    finish(verdict) {
        const p = this.el(); if (!p) return;
        clearTimeout(this._t1);
        p.classList.remove("running");
        p.querySelectorAll(".pipe-node").forEach((n) => n.classList.remove("active"));
        const pass = verdict === "pass";
        const dots = { contracts: pass ? "pass" : "fail", recon: pass ? "pass" : "fail", anomaly: pass ? "pass" : "fail" };
        Object.entries(dots).forEach(([c, cls]) => {
            const dot = p.querySelector(`[data-check="${c}"]`);
            if (dot) dot.className = "dot " + cls;
        });
        const target = p.querySelector(pass ? '[data-stage="publish"]' : '[data-stage="quarantine"]');
        target.classList.add("flash");
        setTimeout(() => target.classList.remove("flash"), 4000);
    },
    idle() {
        const p = this.el(); if (!p) return;
        clearTimeout(this._t1);
        p.classList.remove("running");
        p.querySelectorAll(".pipe-node").forEach((n) => n.classList.remove("active", "flash"));
    },
};

/* ========================================================== dashboard ==== */
function renderHealth(d) {
    const score = d.health_score;
    document.getElementById("health-score").textContent = score + "%";
    const bar = document.getElementById("gauge-bar");
    if (bar) {
        const C = 245; // 2πr for r=39
        bar.style.strokeDashoffset = String(C - (C * Math.min(score, 100)) / 100);
        bar.style.stroke = score >= 80 ? "var(--good)" : score >= 60 ? "var(--warn)" : "var(--bad)";
    }
    document.getElementById("healthy-count").textContent = d.healthy_count;
    document.getElementById("quarantined-count").textContent = d.quarantined_count;
    document.getElementById("incidents-open").textContent = d.incidents_open;
    document.getElementById("contracts-generated").textContent = d.contracts_auto_generated;
    const lat = document.getElementById("detection-latency");
    if (lat) lat.textContent = d.avg_detection_latency_ms != null
        ? (d.avg_detection_latency_ms >= 1000
            ? (d.avg_detection_latency_ms / 1000).toFixed(1) + "s"
            : Math.round(d.avg_detection_latency_ms) + "ms")
        : "—";
    const prev = document.getElementById("prevention-rate");
    if (prev) prev.textContent = d.prevention_rate_pct != null
        ? `${d.prevention_rate_pct}% prevention rate — none reached production`
        : "quarantined before production";
    document.getElementById("last-run").innerHTML = d.last_run
        ? `last: <b>${esc(d.last_run.batch_id)}</b> ${badge(d.last_run.verdict, d.last_run.verdict === "pass" ? "pass" : "fail")}<br>${esc(fmtTime(d.last_run.started_at))}`
        : "no runs yet";
}

let lastTopRunId = null;

function renderRuns(rows) {
    const body = document.getElementById("runs-body");
    document.getElementById("runs-count").textContent = rows.length;
    if (!rows.length) {
        body.innerHTML = `<tr class="empty-row"><td colspan="6">No runs yet — click “Run Good Batch” or “Run Bad Batch”.</td></tr>`;
        return;
    }
    const newest = rows[0]?.id;
    body.innerHTML = rows.map((r, i) => `
        <tr${i === 0 && newest !== lastTopRunId && lastTopRunId !== null ? ' class="row-new"' : ""}>
            <td class="mono">${esc(r.batch_id)}</td>
            <td>${badge(r.verdict || "pending", r.verdict === "pass" ? "pass" : r.verdict === "fail" ? "fail" : "proposed")}</td>
            <td>${r.published ? '<span class="check-yes">✓</span>' : '<span class="check-no">—</span>'}</td>
            <td>${r.quarantined ? '<span class="check-yes" style="color:var(--bad)">✓</span>' : '<span class="check-no">—</span>'}</td>
            <td class="mono">${esc(fmtTime(r.started_at))}</td>
            <td>${esc(r.summary || "")}</td>
        </tr>
    `).join("");
    lastTopRunId = newest;
}

function renderContracts(rows) {
    const body = document.getElementById("contracts-body");
    document.getElementById("contracts-count").textContent = rows.length;
    if (!rows.length) {
        body.innerHTML = `<tr class="empty-row"><td colspan="7">No contracts proposed yet.</td></tr>`;
        return;
    }
    body.innerHTML = rows.map((c) => `
        <tr>
            <td class="mono">${esc(c.schema_name)}.${esc(c.table_name)}</td>
            <td class="mono">${c.column_name ? esc(c.column_name) : '<span class="muted">(table-level)</span>'}</td>
            <td class="mono">${esc(c.rule_type)}</td>
            <td>${badge(c.status, c.status)}</td>
            <td class="mono">${c.confidence != null ? Number(c.confidence).toFixed(2) : "—"}</td>
            <td>${esc(c.rationale || "")}</td>
            <td style="white-space:nowrap">
                ${c.status === "proposed" ? `
                    <button class="link-btn approve" onclick="approveContract(${Number(c.id)})">Approve</button>
                    <button class="link-btn reject" onclick="rejectContract(${Number(c.id)})">Reject</button>
                ` : ""}
            </td>
        </tr>
    `).join("");
}

function renderIncidents(rows) {
    const body = document.getElementById("incidents-body");
    document.getElementById("incidents-count").textContent = rows.length;
    if (!rows.length) {
        body.innerHTML = `<tr class="empty-row"><td colspan="6">No incidents — run a bad batch and watch the gate catch it.</td></tr>`;
        return;
    }
    body.innerHTML = rows.map((i) => `
        <tr>
            <td class="mono">${esc(i.batch_id)}</td>
            <td>${badge(i.severity || "unknown", i.severity || "medium")}</td>
            <td>${badge(i.status, i.status)}</td>
            <td>${esc(i.title || "")}</td>
            <td class="mono">${i.confidence != null ? Number(i.confidence).toFixed(2) : "—"}</td>
            <td><a class="incident-link" href="${incidentHref(i.id)}">View report →</a></td>
        </tr>
    `).join("");
}

async function refreshDashboard() {
    const [health, runs, contracts, incidents] = await Promise.all([
        getJSON("/api/health-score"),
        getJSON("/api/runs"),
        getJSON("/api/contracts"),
        getJSON("/api/incidents"),
    ]);
    renderHealth(health);
    renderRuns(runs);
    renderContracts(contracts);
    renderIncidents(incidents);
}

async function approveContract(id) {
    await postJSON(`/api/contracts/${id}/approve`);
    toast("Contract approved — now enforced at the audit gate", "good");
    refreshDashboard();
}

async function rejectContract(id) {
    await postJSON(`/api/contracts/${id}/reject`);
    toast("Contract rejected");
    refreshDashboard();
}

async function runBatch(kind, btn) {
    btn.disabled = true;
    btn.classList.add("loading");
    const other = document.querySelectorAll(".actions .btn");
    other.forEach((b) => (b.disabled = true));
    pipeline.start();
    try {
        const result = await postJSON(`/api/run/${kind}`);
        pipeline.finish(result.verdict);
        if (result.verdict === "pass") {
            toast(`✓ ${result.batch_id} passed audit — published to production`, "good");
        } else {
            toast(`✕ ${result.batch_id} failed audit — quarantined, production untouched`, "bad");
        }
        await refreshDashboard();
    } catch (e) {
        pipeline.idle();
        toast("Run failed — see server logs", "bad");
    } finally {
        other.forEach((b) => (b.disabled = false));
        btn.disabled = false;
        btn.classList.remove("loading");
    }
}

async function resetDemo(btn) {
    btn.disabled = true;
    btn.classList.add("loading");
    try {
        await postJSON("/api/reset");
        pipeline.idle();
        lastTopRunId = null;
        toast("Demo reset — 8-day clean history restored");
        await refreshDashboard();
    } finally {
        btn.disabled = false;
        btn.classList.remove("loading");
    }
}

/* =========================================================== incident ==== */
function renderIncidentDetail(data) {
    const inc = data.incident;
    if (!inc) {
        document.getElementById("incident-title").textContent = "Incident not found";
        return;
    }
    document.getElementById("incident-title").textContent = inc.title || `Incident #${inc.id}`;
    const hero = document.getElementById("incident-panel");
    hero.className = "incident-hero sev-" + (inc.severity || "medium");
    document.getElementById("incident-severity").outerHTML =
        badge(inc.severity || "unknown", inc.severity || "medium").replace('class="badge', 'id="incident-severity" class="badge');
    document.getElementById("incident-status").outerHTML =
        badge(inc.status, inc.status).replace('class="badge', 'id="incident-status" class="badge');
    document.getElementById("incident-confidence").outerHTML =
        `<span id="incident-confidence" class="badge badge-neutral">confidence ${inc.confidence != null ? Number(inc.confidence).toFixed(2) : "—"}</span>`;
    document.getElementById("incident-root-cause").textContent = inc.root_cause_ai || "Not yet investigated.";
    document.getElementById("incident-downstream").textContent = inc.downstream_impact || "—";
    document.getElementById("incident-action").textContent = inc.recommended_action || "—";

    const list = document.getElementById("evidence-list");
    const count = document.getElementById("evidence-count");
    if (count) count.textContent = data.evidence.length;
    list.innerHTML = data.evidence.map((e) => `
        <div class="evidence-block">
            <h4>${esc(e.evidence_type)}</h4>
            <pre>${esc(JSON.stringify(JSON.parse(e.evidence_json), null, 2))}</pre>
        </div>
    `).join("") || '<div class="evidence-block">No evidence recorded.</div>';
}

async function refreshIncident(incidentId) {
    const data = await getJSON(`/api/incidents/${incidentId}`);
    renderIncidentDetail(data);
}

/* ================================================================ init ==== */
document.addEventListener("DOMContentLoaded", () => {
    const runsBody = document.getElementById("runs-body");
    if (runsBody) {
        document.getElementById("btn-run-good").addEventListener("click", (e) => runBatch("good", e.currentTarget));
        document.getElementById("btn-run-bad").addEventListener("click", (e) => runBatch("bad", e.currentTarget));
        document.getElementById("btn-reset").addEventListener("click", (e) => resetDemo(e.currentTarget));
        refreshDashboard();
        if (!DEMO) setInterval(refreshDashboard, REFRESH_MS);
    }

    const incidentPanel = document.getElementById("incident-panel");
    if (incidentPanel && document.getElementById("evidence-list")) {
        const fromQuery = new URLSearchParams(location.search).get("id");
        const incidentId = DEMO ? fromQuery : (incidentPanel.dataset.incidentId || fromQuery);
        const back = document.getElementById("back-link");
        if (back && DEMO) back.href = "index.html";
        if (incidentId != null) {
            refreshIncident(incidentId);
            if (!DEMO) setInterval(() => refreshIncident(incidentId), REFRESH_MS);
        }
    }
});
