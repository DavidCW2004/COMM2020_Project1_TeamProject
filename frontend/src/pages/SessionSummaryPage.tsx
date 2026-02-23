import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";

type Member = {
    user_id: number;
    username: string;
    display_name: string;
    post_count: number;
    contribution_percentage: number;
    lacks_evidence_count: number;
    posts_by_phase: Record<string, number>;
};

type Phase = {
    index: number;
    name: string;
    duration_seconds: number;
    post_count: number;
    intervention_count: number;
};

type QualityFlag = {
    code: string;
    label: string;
    triggered: boolean;
    count: number;
    details: string;
};

type Decision = {
    content: string;
    author: string;
    phase: string;
    timestamp: string;
};

type ActionItem = {
    content: string;
    author: string;
    timestamp: string;
};

type SessionSummaryData = {
    room_code: string;
    room_name: string;
    activity_run_id: string;
    activity_name: string | null;
    created_at: string;
    activity_started_at: string | null;
    activity_ended_at: string | null;

    decisions: Decision[];
    action_items: ActionItem[];
    unanswered_questions: Array<{ content: string; author: string; timestamp: string; phase: string }>;
    final_outcome: { content: string; author: string; timestamp: string } | null;

    participation: {
        total_posts: number;
        total_interventions: number;
        members: Member[];
        turn_balance_score: number;
        gini_coefficient: number;
    };

    process: {
        phases: Phase[];
        interventions_by_rule?: Record<string, number>;
        total_duration_seconds: number;
    };

    quality: {
        flags: QualityFlag[];
        overall_score: string;
    } | null;

    personal_contribution: {
        post_count: number;
        contribution_percentage: number;
        lacks_evidence_count: number;
        posts_by_phase: Record<string, number>;
    } | null;

    is_facilitator: boolean;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "/").replace(/\/$/, "");

export default function SessionSummaryPage() {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();

    const [summary, setSummary] = useState<SessionSummaryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"overview" | "participation" | "process" | "quality">(
        "overview"
    );

    async function fetchSummary() {
        if (!code) return;

        try {
            setLoading(true);
            setError(null);

            const res = await fetch(`${API_BASE_URL}/api/rooms/${encodeURIComponent(code)}/summary/`, {
                credentials: "include",
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail || `Failed to load summary (${res.status})`);
            }

            const data = await res.json();
            setSummary(data);
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : "Failed to load summary";
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void fetchSummary();
    }, [code]);

    async function handleExportPDF() {
        if (!code) return;

        try {
            setError(null);

            const res = await fetch(
                `${API_BASE_URL}/api/rooms/${encodeURIComponent(code)}/summary/export/`,
                { credentials: "include" }
            );

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail || "Failed to generate PDF");
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `session_summary_${code}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : "Failed to export PDF";
            setError(errorMessage);
        }
    }

    const tabs = useMemo(() => {
        const base: Array<"overview" | "participation" | "process" | "quality"> = [
            "overview",
            "participation",
            "process",
        ];
        if (summary?.is_facilitator) base.push("quality");
        return base;
    }, [summary?.is_facilitator]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-primary/10 via-muted/40 to-background text-foreground px-4 py-10">
                <div className="mx-auto w-full max-w-5xl">
                    <div className="rounded-lg border border-border bg-background p-10 text-center text-sm text-muted-foreground shadow-sm">
                        Loading summary…
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-primary/10 via-muted/40 to-background text-foreground px-4 py-10">
                <div className="mx-auto w-full max-w-5xl space-y-4">
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                    <Button onClick={() => navigate(`/room/${code}`)}>Back to room</Button>
                </div>
            </div>
        );
    }

    if (!summary) return null;

    return (
        <div className="min-h-screen bg-gradient-to-b from-primary/10 via-muted/40 to-background text-foreground px-4 py-10">
            <div className="mx-auto w-full max-w-5xl space-y-6">
                <div className="rounded-lg border border-border bg-background/80 backdrop-blur p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                            <h1 className="text-2xl font-semibold tracking-tight">Session summary</h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">{summary.activity_name ?? "Activity"}</span>{" "}
                                · Room{" "}
                                <span className="font-medium text-foreground">{summary.room_code}</span>
                            </p>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                            <Button variant="secondary" onClick={() => navigate(`/room/${code}`)}>
                                Back to room
                            </Button>
                            <Button variant="secondary" onClick={() => void fetchSummary()}>
                                Refresh
                            </Button>
                            {summary.is_facilitator && (
                                <Button onClick={handleExportPDF}>Export PDF</Button>
                            )}
                        </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                        {tabs.map((tab) => {
                            const active = activeTab === tab;
                            return (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setActiveTab(tab)}
                                    className={[
                                        "px-3 py-2 rounded-full border text-sm transition",
                                        active
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border bg-background hover:bg-muted/40 text-foreground",
                                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                    ].join(" ")}
                                >
                                    {tabLabel(tab)}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div
                    className="rounded-lg border border-border bg-background shadow-sm overflow-hidden flex flex-col"
                    style={{ height: "clamp(520px, 72vh, 900px)" }}
                >
                    <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                        <h2 className="text-lg font-semibold">{tabLabel(activeTab)}</h2>
                        <span className="text-sm text-muted-foreground">
                            {summary.is_facilitator ? "Facilitator view" : "Learner view"}
                        </span>
                    </div>

                    <div className="flex-1 overflow-auto px-6 py-5">
                        {activeTab === "overview" && <OverviewTab summary={summary} />}
                        {activeTab === "participation" && <ParticipationTab summary={summary} />}
                        {activeTab === "process" && <ProcessTab summary={summary} />}
                        {activeTab === "quality" && summary.quality && <QualityTab quality={summary.quality} />}
                    </div>
                </div>
            </div>
        </div>
    );
}


function tabLabel(tab: "overview" | "participation" | "process" | "quality") {
    return tab.charAt(0).toUpperCase() + tab.slice(1);
}

function SectionHeading({ children }: { children: React.ReactNode }) {
    return (
        <h3 className="mt-6 mb-3 text-base font-semibold border-b border-border pb-2">
            {children}
        </h3>
    );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="rounded-lg border border-border bg-muted/20 p-4 text-center">
            <div className="text-2xl font-semibold">{value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{label}</div>
        </div>
    );
}


function OverviewTab({ summary }: { summary: SessionSummaryData }) {
    return (
        <div className="space-y-2">
            <SectionHeading>Key decisions</SectionHeading>
            {summary.decisions.length > 0 ? (
                <ul className="pl-5 text-sm text-muted-foreground space-y-2">
                    {summary.decisions.map((d, i) => (
                        <li key={i}>
                            <span className="font-medium text-foreground">{d.author}</span>{" "}
                            <span className="text-muted-foreground">({d.phase})</span>: {d.content}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground italic">No explicit decisions captured.</p>
            )}

            <SectionHeading>Action items</SectionHeading>
            {summary.action_items.length > 0 ? (
                <ul className="pl-5 text-sm text-muted-foreground space-y-2">
                    {summary.action_items.map((item, i) => (
                        <li key={i}>
                            <span className="font-medium text-foreground">{item.author}</span>: {item.content}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground italic">No action items identified.</p>
            )}

            <SectionHeading>Unanswered questions</SectionHeading>
            {summary.unanswered_questions.length > 0 ? (
                <ul className="pl-5 text-sm text-muted-foreground space-y-2">
                    {summary.unanswered_questions.map((q, i) => (
                        <li key={i}>
                            <span className="font-medium text-foreground">{q.author}</span>: {q.content}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground italic">All questions were addressed.</p>
            )}

            <SectionHeading>Group outcome</SectionHeading>
            {summary.final_outcome ? (
                <blockquote className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                    <span className="text-foreground">“{summary.final_outcome.content}”</span>{" "}
                    — <em>{summary.final_outcome.author}</em>
                </blockquote>
            ) : (
                <p className="text-sm text-muted-foreground italic">No final outcome recorded.</p>
            )}

            {summary.personal_contribution && (
                <>
                    <SectionHeading>Your contribution</SectionHeading>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
                        <div>
                            <span className="font-medium">Posts:</span>{" "}
                            {summary.personal_contribution.post_count}
                        </div>
                        <div className="mt-1">
                            <span className="font-medium">Contribution:</span>{" "}
                            {summary.personal_contribution.contribution_percentage.toFixed(1)}%
                        </div>
                        <div className="mt-1">
                            <span className="font-medium">Evidence issues:</span>{" "}
                            {summary.personal_contribution.lacks_evidence_count}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}


function ParticipationTab({ summary }: { summary: SessionSummaryData }) {
    const { participation } = summary;

    return (
        <div>
            <SectionHeading>Overview</SectionHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Total posts" value={participation.total_posts} />
                <StatCard label="Total interventions" value={participation.total_interventions} />
                <StatCard label="Turn balance" value={`${(participation.turn_balance_score * 100).toFixed(0)}%`} />
                <StatCard label="Participants" value={participation.members.length} />
            </div>

            <SectionHeading>Per-member breakdown</SectionHeading>
            <div className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full text-sm">
                    <thead className="bg-muted/30">
                        <tr>
                            <th className="px-3 py-2 text-left border-b border-border">Name</th>
                            <th className="px-3 py-2 text-center border-b border-border">Posts</th>
                            <th className="px-3 py-2 text-center border-b border-border">%</th>
                            <th className="px-3 py-2 text-center border-b border-border">Evidence issues</th>
                        </tr>
                    </thead>
                    <tbody>
                        {participation.members.map((m) => (
                            <tr key={m.user_id} className="border-b border-border">
                                <td className="px-3 py-2">{m.display_name}</td>
                                <td className="px-3 py-2 text-center">{m.post_count}</td>
                                <td className="px-3 py-2 text-center">{m.contribution_percentage.toFixed(1)}%</td>
                                <td className="px-3 py-2 text-center">{m.lacks_evidence_count}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}


function ProcessTab({ summary }: { summary: SessionSummaryData }) {
    const { process } = summary;

    return (
        <div>
            <SectionHeading>Phase breakdown</SectionHeading>
            <div className="grid gap-3">
                {process.phases.map((phase) => (
                    <div key={phase.index} className="rounded-lg border border-border bg-muted/20 p-4">
                        <div className="font-semibold capitalize">{phase.name}</div>
                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span>
                                Duration:{" "}
                                <span className="font-medium text-foreground">
                                    {Math.floor(phase.duration_seconds / 60)} min
                                </span>
                            </span>
                            <span>
                                Posts: <span className="font-medium text-foreground">{phase.post_count}</span>
                            </span>
                            <span>
                                Interventions:{" "}
                                <span className="font-medium text-foreground">{phase.intervention_count}</span>
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {summary.is_facilitator &&
                process.interventions_by_rule &&
                Object.keys(process.interventions_by_rule).length > 0 && (
                    <>
                        <SectionHeading>Interventions by type</SectionHeading>
                        <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="min-w-full text-sm">
                                <tbody>
                                    {Object.entries(process.interventions_by_rule).map(([rule, count]) => (
                                        <tr key={rule} className="border-b border-border">
                                            <td className="px-3 py-2">
                                                {rule.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                                            </td>
                                            <td className="px-3 py-2 text-right font-medium">{count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
        </div>
    );
}


function QualityTab({ quality }: { quality: { flags: QualityFlag[]; overall_score: string } }) {
    const scoreLabel = quality.overall_score.replace(/_/g, " ").toUpperCase();

    const scoreClass =
        quality.overall_score === "good"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : quality.overall_score === "needs_attention"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : quality.overall_score === "concerning"
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-border bg-muted/20 text-foreground";

    return (
        <div>
            <SectionHeading>Overall assessment</SectionHeading>
            <div className={`rounded-lg border p-4 text-center font-semibold ${scoreClass}`}>
                {scoreLabel}
            </div>

            <SectionHeading>Quality checks</SectionHeading>
            <div className="grid gap-3">
                {quality.flags.map((flag) => (
                    <div
                        key={flag.code}
                        className={[
                            "rounded-lg border p-4",
                            flag.triggered ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50",
                        ].join(" ")}
                    >
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="font-semibold">{flag.label}</div>
                            <span
                                className={[
                                    "text-xs rounded-full px-2 py-0.5 font-semibold",
                                    flag.triggered ? "bg-red-600 text-white" : "bg-emerald-600 text-white",
                                ].join(" ")}
                            >
                                {flag.triggered ? "FLAGGED" : "OK"}
                            </span>
                            {typeof flag.count === "number" ? (
                                <span className="text-xs text-muted-foreground">· {flag.count}</span>
                            ) : null}
                        </div>
                        {flag.details ? (
                            <p className="mt-2 text-sm text-muted-foreground">{flag.details}</p>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
}