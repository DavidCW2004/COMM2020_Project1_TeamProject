import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import styles from "../styles/Login.module.css";
import type { FacilitatorSessionSummary } from "../api/client";
import { fetchFacilitatorRoomSummary, regenerateFacilitatorRoomSummary } from "../api/client";
import { exportFacilitatorSummaryPDF } from "../api/client";

type SummaryState =
    | { status: "loading" }
    | { status: "missing" }
    | { status: "ready"; data: FacilitatorSessionSummary }
    | { status: "error"; message: string };

export default function FacilitatorRoomSummaryPage() {
    const navigate = useNavigate();
    const { code } = useParams<{ code: string }>();
    const [searchParams] = useSearchParams();
    const activityRunId = searchParams.get("activity_run_id") || undefined;

    const [state, setState] = useState<SummaryState>({ status: "loading" });
    const [busy, setBusy] = useState(false);

    const title = useMemo(() => {
        if (!code) return "Room Summary";
        return `Room Summary · ${code.toUpperCase()}`;
    }, [code]);

    async function load() {
        if (!code) return;

        setState({ status: "loading" });
        try {
            const data = await fetchFacilitatorRoomSummary(code, activityRunId);
            setState({ status: "ready", data });
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load summary";

            if (msg.toLowerCase().includes("not yet generated")) {
                setState({ status: "missing" });
            } else {
                setState({ status: "error", message: msg });
            }
        }
    }

    async function regenerate() {
        if (!code) return;

        setBusy(true);
        try {
            await regenerateFacilitatorRoomSummary(code, activityRunId);
            await load();
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to regenerate summary";
            setState({ status: "error", message: msg });
        } finally {
            setBusy(false);
        }
    }


    async function downloadPdf() {
        if (!code) return;

        try {
            const blob = await exportFacilitatorSummaryPDF(code, activityRunId);

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;

            const runSuffix = activityRunId ? `_${activityRunId}` : "";
            a.download = `session_summary_${code.toUpperCase()}${runSuffix}.pdf`;

            document.body.appendChild(a);
            a.click();
            a.remove();

            window.URL.revokeObjectURL(url);
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to download PDF";
            setState({ status: "error", message: msg });
        }
    }

    useEffect(() => {
        void load();
    }, [code, activityRunId]);

    return (
        <div className={styles.page}>
            <div className={styles.rectangleParent}>
                <div className={styles.frameDiv}>
                    <div className={styles.rectangleDiv} />
                    <h2 className={styles.socialStudyTeammates}>{title}</h2>
                    <div className={styles.collaborativeLearningWith}>
                        {activityRunId ? `Run: ${activityRunId}` : "Latest run"}
                    </div>
                </div>
                <div className={styles.membersListParent} style={{ width: "100%" }}>
                    <div className={styles.membersHeading} style={{ fontSize: 28 }}>
                        Session Summary
                    </div>
                    <div style={{ padding: 12, display: "flex", gap: 10 }}>
                        <button
                            className={styles.primaryButton}
                            type="button"
                            style={{ height: 36 }}
                            onClick={() => navigate("/facilitator")}
                        >
                            ← Back
                        </button>

                        <button
                            className={styles.primaryButton}
                            type="button"
                            style={{ height: 36 }}
                            onClick={() => void load()}
                            disabled={busy || state.status === "loading"}
                        >
                            Refresh
                        </button>

                        <button
                            className={styles.primaryButton}
                            type="button"
                            style={{ height: 36 }}
                            onClick={() => void regenerate()}
                            disabled={busy}
                        >
                            {busy ? "Generating…" : "Generate / Regenerate"}
                        </button>

                        <button
                            className={styles.primaryButton}
                            type="button"
                            style={{ height: 36 }}
                            onClick={() => void downloadPdf()}
                            disabled={!code || busy || state.status !== "ready"}
                        >
                            Download PDF
                        </button>

                    </div>
                    <div className={styles.scrollArea} style={{ padding: 12 }}>
                        {state.status === "loading" && (
                            <div style={{ textAlign: "center", opacity: 0.8, padding: 20 }}>
                                Loading summary…
                            </div>
                        )}

                        {state.status === "missing" && (
                            <div className={styles.emptyState}>
                                <div className={styles.emptyTitle}>Summary not generated yet</div>
                                <div className={styles.emptySubtitle}>
                                    Click “Generate / Regenerate” to create a summary for this run.
                                </div>
                            </div>
                        )}

                        {state.status === "error" && <div className={styles.error}>{state.message}</div>}

                        {state.status === "ready" && (
                            <div style={{ display: "grid", gap: 12 }}>
                                <ParticipationSummary data={state.data.participation} />
                                <QualitySummary data={state.data.quality} />
                                <ProcessSummary data={state.data.process} />
                                <OutcomesSummary data={state.data.outcomes} />

                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SummaryBlock({ title, value }: { title: string; value: any }) {
    return (
        <div
            style={{
                background: "#D9D9D9",
                borderRadius: 6,
                padding: 12,
            }}
        >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
            <pre
                style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontSize: 13,
                    lineHeight: 1.35,
                }}
            >
                {formatValue(value)}
            </pre>
        </div>
    );
}

function formatValue(value: any) {
    if (value == null) return "—";
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function ParticipationSummary({ data }: { data: any }) {
    if (!data) {
        return <SummaryBlock title="Participation" value={null} />;
    }

    const members = Array.isArray(data.members) ? data.members : [];

    const balanceLabel =
        typeof data.turn_balance_score === "number"
            ? data.turn_balance_score >= 0.9
                ? "Well balanced"
                : data.turn_balance_score >= 0.6
                    ? "Moderately balanced"
                    : "Imbalanced"
            : "—";

    const inequalityLabel =
        typeof data.gini_coefficient === "number"
            ? data.gini_coefficient < 0.2
                ? "Very low"
                : data.gini_coefficient < 0.4
                    ? "Low"
                    : data.gini_coefficient < 0.6
                        ? "Moderate"
                        : "High"
            : "—";

    return (
        <div style={{ background: "#D9D9D9", borderRadius: 6, padding: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Participation</div>

            <div style={{ display: "grid", gap: 6, fontSize: 13, marginBottom: 12 }}>
                <div>
                    <b>Total posts:</b> {data.total_posts ?? "—"}
                </div>
                <div>
                    <b>Total interventions:</b> {data.total_interventions ?? "—"}
                </div>
                <div>
                    <b>Turn balance:</b> {balanceLabel}
                    {typeof data.turn_balance_score === "number" ? ` (${data.turn_balance_score})` : ""}
                </div>
                <div>
                    <b>Participation inequality:</b> {inequalityLabel}
                    {typeof data.gini_coefficient === "number" ? ` (${data.gini_coefficient})` : ""}
                </div>
            </div>

            <div style={{ fontWeight: 700, marginBottom: 8 }}>Member contributions</div>

            {members.length === 0 ? (
                <div style={{ opacity: 0.8 }}>No member breakdown available.</div>
            ) : (
                <div style={{ display: "grid", gap: 8 }}>
                    {members.map((m: any) => (
                        <div
                            key={m.user_id ?? m.username}
                            style={{
                                background: "#f2efef",
                                border: "1px solid #cfcfcf",
                                borderRadius: 10,
                                padding: 10,
                            }}
                        >
                            <div style={{ fontWeight: 700 }}>
                                {m.display_name || m.username || "Unknown"}
                            </div>

                            <div style={{ fontSize: 13, marginTop: 4 }}>
                                Posts: <b>{m.post_count ?? 0}</b>
                                {typeof m.contribution_percentage === "number"
                                    ? ` · ${Math.round(m.contribution_percentage)}%`
                                    : ""}
                            </div>

                            {m.posts_by_phase && typeof m.posts_by_phase === "object" ? (
                                <div style={{ fontSize: 12, marginTop: 4, opacity: 0.9 }}>
                                    By phase:{" "}
                                    {Object.entries(m.posts_by_phase).map(([phase, count]) => (
                                        <span key={phase} style={{ marginRight: 10 }}>
                                            Phase {Number(phase) + 1}: {String(count)}
                                        </span>
                                    ))}
                                </div>
                            ) : null}

                            <div style={{ fontSize: 12, marginTop: 4 }}>
                                Evidence gaps flagged: <b>{m.lacks_evidence_count ?? 0}</b>
                            </div>

                            <div style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>
                                Active: {formatTime(m.first_post_at)} → {formatTime(m.last_post_at)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function QualitySummary({ data }: { data: any }) {
    if (!data) return <SummaryBlock title="Quality" value={null} />;

    const score = String(data.overall_score ?? "—");
    const flags = Array.isArray(data.flags) ? data.flags : [];

    const scoreText =
        score === "good" ? "Good" :
            score === "mixed" ? "Mixed" :
                score === "concerning" ? "Concerning" :
                    score;

    const scoreNote =
        score === "concerning"
            ? "Multiple quality risks flagged — consider prompting for evidence and critique."
            : score === "mixed"
                ? "Some quality risks flagged — light facilitation may help."
                : score === "good"
                    ? "Quality looks solid overall."
                    : "";

    const triggered = flags.filter((f: any) => f?.triggered);
    const notTriggered = flags.filter((f: any) => !f?.triggered);

    return (
        <div style={{ background: "#D9D9D9", borderRadius: 6, padding: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Quality</div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                <span
                    style={{
                        padding: "4px 10px",
                        borderRadius: 999,
                        border: "1px solid #cfcfcf",
                        background: "#f2efef",
                        fontSize: 12,
                        fontWeight: 700,
                    }}
                >
                    Overall: {scoreText}
                </span>
                {scoreNote && <span style={{ fontSize: 12, opacity: 0.85 }}>{scoreNote}</span>}
            </div>

            <div style={{ fontWeight: 700, margin: "10px 0 6px" }}>Triggered flags</div>
            {triggered.length === 0 ? (
                <div style={{ opacity: 0.8 }}>No flags triggered.</div>
            ) : (
                <div style={{ display: "grid", gap: 8 }}>
                    {triggered.map((f: any) => (
                        <div
                            key={f.code ?? f.label}
                            style={{
                                background: "#f2efef",
                                border: "1px solid #cfcfcf",
                                borderRadius: 10,
                                padding: 10,
                            }}
                        >
                            <div style={{ fontWeight: 700 }}>
                                {f.label ?? f.code ?? "Flag"}
                                {typeof f.count === "number" ? (
                                    <span style={{ fontWeight: 600, opacity: 0.8 }}> · {f.count}</span>
                                ) : null}
                            </div>
                            {f.details ? <div style={{ fontSize: 12, marginTop: 4, opacity: 0.85 }}>{String(f.details)}</div> : null}
                        </div>
                    ))}
                </div>
            )}

            {notTriggered.length > 0 && (
                <>
                    <div style={{ fontWeight: 700, margin: "12px 0 6px" }}>Not triggered</div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>
                        {notTriggered.map((f: any) => f.label ?? f.code).filter(Boolean).join(" · ")}
                    </div>
                </>
            )}
        </div>
    );
}

function ProcessSummary({ data }: { data: any }) {
    if (!data) return <SummaryBlock title="Process" value={null} />;

    const phases = Array.isArray(data.phases) ? data.phases : [];
    const rules = data.interventions_by_rule && typeof data.interventions_by_rule === "object"
        ? data.interventions_by_rule
        : {};

    const totalDuration = typeof data.total_duration_seconds === "number" ? data.total_duration_seconds : null;

    const mostInterventionRule = (() => {
        const entries = Object.entries(rules) as Array<[string, any]>;
        if (entries.length === 0) return null;
        entries.sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0));
        return { rule: entries[0][0], count: Number(entries[0][1]) || 0 };
    })();

    return (
        <div style={{ background: "#D9D9D9", borderRadius: 6, padding: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Process</div>

            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 10 }}>
                Total duration: <b>{totalDuration != null ? formatDuration(totalDuration) : "—"}</b>
                {mostInterventionRule ? (
                    <>
                        {" "}· Most frequent intervention: <b>{prettyRule(mostInterventionRule.rule)}</b> ({mostInterventionRule.count})
                    </>
                ) : null}
            </div>

            <div style={{ fontWeight: 700, marginBottom: 6 }}>Phases</div>

            {phases.length === 0 ? (
                <div style={{ opacity: 0.8 }}>No phase breakdown available.</div>
            ) : (
                <div style={{ display: "grid", gap: 8 }}>
                    {phases.map((p: any) => (
                        <div
                            key={p.index ?? p.name}
                            style={{
                                background: "#f2efef",
                                border: "1px solid #cfcfcf",
                                borderRadius: 10,
                                padding: 10,
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 12,
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: 700 }}>
                                    Phase {typeof p.index === "number" ? p.index + 1 : "—"}: {String(p.name ?? "—")}
                                </div>
                                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
                                    Duration: {typeof p.duration_seconds === "number" ? formatDuration(p.duration_seconds) : "—"}
                                </div>
                            </div>

                            <div style={{ textAlign: "right", fontSize: 12 }}>
                                <div>Posts: <b>{p.post_count ?? 0}</b></div>
                                <div>Interventions: <b>{p.intervention_count ?? 0}</b></div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ fontWeight: 700, margin: "12px 0 6px" }}>Interventions by rule</div>

            {Object.keys(rules).length === 0 ? (
                <div style={{ opacity: 0.8 }}>No intervention breakdown available.</div>
            ) : (
                <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
                    {Object.entries(rules)
                        .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
                        .map(([rule, count]) => (
                            <div
                                key={rule}
                                style={{
                                    background: "#f2efef",
                                    border: "1px solid #cfcfcf",
                                    borderRadius: 10,
                                    padding: "8px 10px",
                                    display: "flex",
                                    justifyContent: "space-between",
                                }}
                            >
                                <span style={{ fontWeight: 700 }}>{prettyRule(rule)}</span>
                                <span>{Number(count) || 0}</span>
                            </div>
                        ))}
                </div>
            )}
        </div>
    );
}


function OutcomesSummary({ data }: { data: any }) {
    if (!data) return <SummaryBlock title="Outcomes" value={null} />;

    const decisions = Array.isArray(data.decisions) ? data.decisions : [];
    const actionItems = Array.isArray(data.action_items) ? data.action_items : [];
    const unanswered = Array.isArray(data.unanswered_questions) ? data.unanswered_questions : [];
    const finalOutcome = data.final_outcome;

    const hasAnything =
        decisions.length > 0 || actionItems.length > 0 || unanswered.length > 0 || finalOutcome;

    return (
        <div style={{ background: "#D9D9D9", borderRadius: 6, padding: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Outcomes</div>

            {!hasAnything ? (
                <div style={{ opacity: 0.85 }}>
                    No decisions or action items were captured for this run.
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                        Tip: ensure the <b>Decide</b> phase includes a clear “What are we doing next?” prompt.
                    </div>
                </div>
            ) : (
                <div style={{ display: "grid", gap: 10 }}>
                    <OutcomeList title="Decisions" items={decisions} emptyText="No decisions recorded." />
                    <OutcomeList title="Action items" items={actionItems} emptyText="No action items recorded." />
                    <OutcomeList title="Unanswered questions" items={unanswered} emptyText="No unanswered questions recorded." />

                    <div
                        style={{
                            background: "#f2efef",
                            border: "1px solid #cfcfcf",
                            borderRadius: 10,
                            padding: 10,
                        }}
                    >
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Final outcome</div>
                        <div style={{ fontSize: 13, opacity: 0.9 }}>
                            {finalOutcome ? String(finalOutcome) : "—"}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function OutcomeList({ title, items, emptyText }: { title: string; items: any[]; emptyText: string }) {
    return (
        <div
            style={{
                background: "#f2efef",
                border: "1px solid #cfcfcf",
                borderRadius: 10,
                padding: 10,
            }}
        >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
            {items.length === 0 ? (
                <div style={{ fontSize: 13, opacity: 0.85 }}>{emptyText}</div>
            ) : (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                    {items.map((x, i) => (
                        <li key={i}>{typeof x === "string" ? x : JSON.stringify(x)}</li>
                    ))}
                </ul>
            )}
        </div>
    );
}



function formatTime(value?: string) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleTimeString();
}

function formatDuration(seconds: number) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}m ${r}s`;
}

function prettyRule(rule: string) {
    return rule
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}
