import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { FacilitatorSessionSummary } from "../api/client";
import { fetchFacilitatorRoomSummary, regenerateFacilitatorRoomSummary, exportFacilitatorSummaryPDF } from "../api/client";
import { Button } from "../components/ui/button";

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
        if (!code) return "Room summary";
        return `Room summary · ${code.toUpperCase()}`;
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
        <div className="min-h-screen bg-gradient-to-b from-primary/10 via-muted/40 to-background text-foreground px-4 py-10">
            <div className="mx-auto w-full max-w-5xl space-y-6">
                <div className="rounded-lg border border-border bg-background/80 backdrop-blur p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {activityRunId ? `Run: ${activityRunId}` : "Latest run"}
                            </p>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                            <Button variant="secondary" onClick={() => navigate("/facilitator")}>
                                ← Back
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => void load()}
                                disabled={busy || state.status === "loading"}
                            >
                                Refresh
                            </Button>
                            <Button variant="secondary" onClick={() => void regenerate()} disabled={busy}>
                                {busy ? "Generating…" : "Generate / regenerate"}
                            </Button>
                            <Button
                                onClick={() => void downloadPdf()}
                                disabled={!code || busy || state.status !== "ready"}
                            >
                                Download PDF
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border border-border bg-background p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <h2 className="text-lg font-semibold">Session summary</h2>
                        <div className="text-sm text-muted-foreground">
                            {state.status === "ready" ? "Ready" : state.status === "loading" ? "Loading…" : ""}
                        </div>
                    </div>

                    <div className="mt-4">
                        {state.status === "loading" && (
                            <div className="space-y-3">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="rounded-lg border border-border bg-background p-4">
                                        <div className="h-5 w-1/3 bg-muted rounded" />
                                        <div className="mt-3 h-4 w-5/6 bg-muted rounded" />
                                        <div className="mt-2 h-4 w-2/3 bg-muted rounded" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {state.status === "missing" && (
                            <div className="rounded-lg border border-border bg-muted/40 p-8 text-center">
                                <div className="text-base font-semibold">Summary not generated yet</div>
                                <div className="mt-2 text-sm text-muted-foreground">
                                    Click “Generate / regenerate” to create a summary for this run.
                                </div>
                            </div>
                        )}

                        {state.status === "error" && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {state.message}
                            </div>
                        )}

                        {state.status === "ready" && (
                            <div className="grid gap-4">
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


function SummaryCard({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-lg border border-border bg-background p-5 shadow-sm">
            <div className="font-semibold text-base">{title}</div>
            <div className="mt-3">{children}</div>
        </div>
    );
}

function SummaryBlock({ title, value }: { title: string; value: any }) {
    return (
        <SummaryCard title={title}>
            <pre className="m-0 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                {formatValue(value)}
            </pre>
        </SummaryCard>
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
    if (!data) return <SummaryBlock title="Participation" value={null} />;

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
        <SummaryCard title="Participation">
            <div className="grid gap-2 text-sm text-muted-foreground">
                <div>
                    <span className="font-medium text-foreground">Total posts:</span>{" "}
                    {data.total_posts ?? "—"}
                </div>
                <div>
                    <span className="font-medium text-foreground">Total interventions:</span>{" "}
                    {data.total_interventions ?? "—"}
                </div>
                <div>
                    <span className="font-medium text-foreground">Turn balance:</span>{" "}
                    {balanceLabel}
                    {typeof data.turn_balance_score === "number"
                        ? ` (${data.turn_balance_score})`
                        : ""}
                </div>
                <div>
                    <span className="font-medium text-foreground">Participation inequality:</span>{" "}
                    {inequalityLabel}
                    {typeof data.gini_coefficient === "number"
                        ? ` (${data.gini_coefficient})`
                        : ""}
                </div>
            </div>

            <div className="mt-5 font-semibold text-sm">Member contributions</div>

            {members.length === 0 ? (
                <div className="mt-2 text-sm text-muted-foreground">
                    No member breakdown available.
                </div>
            ) : (
                <div className="mt-3 grid gap-3">
                    {members.map((m: any) => (
                        <div
                            key={m.user_id ?? m.username}
                            className="rounded-lg border border-border bg-muted/20 p-4"
                        >
                            <div className="font-semibold">
                                {m.display_name || m.username || "Unknown"}
                            </div>

                            <div className="mt-2 text-sm text-muted-foreground">
                                Posts: <span className="font-medium text-foreground">{m.post_count ?? 0}</span>
                                {typeof m.contribution_percentage === "number"
                                    ? ` · ${Math.round(m.contribution_percentage)}%`
                                    : ""}
                            </div>

                            {m.posts_by_phase && typeof m.posts_by_phase === "object" ? (
                                <div className="mt-2 text-xs text-muted-foreground">
                                    By phase:{" "}
                                    {Object.entries(m.posts_by_phase).map(([phase, count]) => (
                                        <span key={phase} className="mr-3">
                                            Phase {Number(phase) + 1}: {String(count)}
                                        </span>
                                    ))}
                                </div>
                            ) : null}

                            <div className="mt-2 text-xs text-muted-foreground">
                                Evidence gaps flagged:{" "}
                                <span className="font-medium text-foreground">
                                    {m.lacks_evidence_count ?? 0}
                                </span>
                            </div>

                            <div className="mt-2 text-xs text-muted-foreground">
                                Active: {formatTime(m.first_post_at)} → {formatTime(m.last_post_at)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </SummaryCard>
    );
}

function QualitySummary({ data }: { data: any }) {
    if (!data) return <SummaryBlock title="Quality" value={null} />;

    const score = String(data.overall_score ?? "—");
    const flags = Array.isArray(data.flags) ? data.flags : [];

    const scoreText =
        score === "good"
            ? "Good"
            : score === "mixed"
                ? "Mixed"
                : score === "concerning"
                    ? "Concerning"
                    : score;

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
        <SummaryCard title="Quality">
            <div className="flex gap-3 items-center flex-wrap">
                <span className="text-xs rounded-full border border-border bg-muted/30 px-3 py-1 font-semibold">
                    Overall: {scoreText}
                </span>
                {scoreNote && <span className="text-xs text-muted-foreground">{scoreNote}</span>}
            </div>

            <div className="mt-4 font-semibold text-sm">Triggered flags</div>

            {triggered.length === 0 ? (
                <div className="mt-2 text-sm text-muted-foreground">No flags triggered.</div>
            ) : (
                <div className="mt-3 grid gap-3">
                    {triggered.map((f: any) => (
                        <div key={f.code ?? f.label} className="rounded-lg border border-border bg-muted/20 p-4">
                            <div className="font-semibold">
                                {f.label ?? f.code ?? "Flag"}
                                {typeof f.count === "number" ? (
                                    <span className="font-medium text-muted-foreground">
                                        {" "}
                                        · {f.count}
                                    </span>
                                ) : null}
                            </div>
                            {f.details ? (
                                <div className="mt-2 text-sm text-muted-foreground">
                                    {String(f.details)}
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>
            )}

            {notTriggered.length > 0 && (
                <>
                    <div className="mt-5 font-semibold text-sm">Not triggered</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                        {notTriggered
                            .map((f: any) => f.label ?? f.code)
                            .filter(Boolean)
                            .join(" · ")}
                    </div>
                </>
            )}
        </SummaryCard>
    );
}

function ProcessSummary({ data }: { data: any }) {
    if (!data) return <SummaryBlock title="Process" value={null} />;

    const phases = Array.isArray(data.phases) ? data.phases : [];
    const rules =
        data.interventions_by_rule && typeof data.interventions_by_rule === "object"
            ? data.interventions_by_rule
            : {};

    const totalDuration =
        typeof data.total_duration_seconds === "number" ? data.total_duration_seconds : null;

    const mostInterventionRule = (() => {
        const entries = Object.entries(rules) as Array<[string, any]>;
        if (entries.length === 0) return null;
        entries.sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0));
        return { rule: entries[0][0], count: Number(entries[0][1]) || 0 };
    })();

    return (
        <SummaryCard title="Process">
            <div className="text-sm text-muted-foreground">
                Total duration:{" "}
                <span className="font-medium text-foreground">
                    {totalDuration != null ? formatDuration(totalDuration) : "—"}
                </span>
                {mostInterventionRule ? (
                    <>
                        {" "}
                        · Most frequent intervention:{" "}
                        <span className="font-medium text-foreground">
                            {prettyRule(mostInterventionRule.rule)}
                        </span>{" "}
                        ({mostInterventionRule.count})
                    </>
                ) : null}
            </div>

            <div className="mt-4 font-semibold text-sm">Phases</div>

            {phases.length === 0 ? (
                <div className="mt-2 text-sm text-muted-foreground">
                    No phase breakdown available.
                </div>
            ) : (
                <div className="mt-3 grid gap-3">
                    {phases.map((p: any) => (
                        <div
                            key={p.index ?? p.name}
                            className="rounded-lg border border-border bg-muted/20 p-4 flex items-start justify-between gap-4"
                        >
                            <div>
                                <div className="font-semibold">
                                    Phase {typeof p.index === "number" ? p.index + 1 : "—"}:{" "}
                                    {String(p.name ?? "—")}
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                    Duration:{" "}
                                    <span className="font-medium text-foreground">
                                        {typeof p.duration_seconds === "number"
                                            ? formatDuration(p.duration_seconds)
                                            : "—"}
                                    </span>
                                </div>
                            </div>

                            <div className="text-right text-sm text-muted-foreground">
                                <div>
                                    Posts: <span className="font-medium text-foreground">{p.post_count ?? 0}</span>
                                </div>
                                <div>
                                    Interventions:{" "}
                                    <span className="font-medium text-foreground">{p.intervention_count ?? 0}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-5 font-semibold text-sm">Interventions by rule</div>

            {Object.keys(rules).length === 0 ? (
                <div className="mt-2 text-sm text-muted-foreground">
                    No intervention breakdown available.
                </div>
            ) : (
                <div className="mt-3 grid gap-2 text-sm">
                    {Object.entries(rules)
                        .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
                        .map(([rule, count]) => (
                            <div
                                key={rule}
                                className="rounded-lg border border-border bg-muted/20 px-3 py-2 flex justify-between"
                            >
                                <span className="font-medium">{prettyRule(rule)}</span>
                                <span className="text-muted-foreground">{Number(count) || 0}</span>
                            </div>
                        ))}
                </div>
            )}
        </SummaryCard>
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
        <SummaryCard title="Outcomes">
            {!hasAnything ? (
                <div className="text-sm text-muted-foreground">
                    No decisions or action items were captured for this run.
                    <div className="mt-2 text-xs text-muted-foreground">
                        Tip: ensure the <span className="font-medium text-foreground">Decide</span> phase includes a clear
                        “What are we doing next?” prompt.
                    </div>
                </div>
            ) : (
                <div className="grid gap-3">
                    <OutcomeList title="Decisions" items={decisions} emptyText="No decisions recorded." />
                    <OutcomeList title="Action items" items={actionItems} emptyText="No action items recorded." />
                    <OutcomeList title="Unanswered questions" items={unanswered} emptyText="No unanswered questions recorded." />

                    <div className="rounded-lg border border-border bg-muted/20 p-4">
                        <div className="font-semibold text-sm">Final outcome</div>
                        <div className="mt-2 text-sm text-muted-foreground">
                            {finalOutcome ? (
                                <div className="space-y-1">
                                    <div>{String(finalOutcome.content ?? "—")}</div>
                                    <div className="text-xs">
                                        By <span className="font-medium text-foreground">{finalOutcome.author}</span>
                                        {" · "}{formatTime(finalOutcome.timestamp)}
                                    </div>
                                </div>
                            ) : "—"}
                        </div>
                    </div>
                </div>
            )}
        </SummaryCard>
    );
}

function OutcomeList({ title, items, emptyText }: { title: string; items: any[]; emptyText: string }) {
    return (
        <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="font-semibold text-sm">{title}</div>
            {items.length === 0 ? (
                <div className="mt-2 text-sm text-muted-foreground">{emptyText}</div>
            ) : (
                <ul className="mt-2 pl-5 text-sm text-muted-foreground space-y-1">
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
    return rule.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}