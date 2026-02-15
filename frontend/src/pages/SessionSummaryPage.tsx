import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "../styles/Login.module.css";

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

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export default function SessionSummaryPage() {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();

    const [summary, setSummary] = useState<SessionSummaryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"overview" | "participation" | "process" | "quality">("overview");

    async function fetchSummary() {
        if (!code) return;

        try {
            setLoading(true);
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
            const res = await fetch(`${API_BASE_URL}/api/rooms/${encodeURIComponent(code)}/summary/export/`, {
                credentials: "include",
            });

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


    if (loading) {
        return (
            <div className={styles.page}>
                <div className={styles.rectangleParent}>
                    <div style={{ textAlign: "center", padding: 40 }}>Loading summary...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.page}>
                <div className={styles.rectangleParent}>
                    <div className={styles.error} style={{ padding: 20 }}>{error}</div>
                    <button className={styles.primaryButton} onClick={() => navigate(`/room/${code}`)}>
                        Back to Room
                    </button>
                </div>
            </div>
        );
    }

    if (!summary) return null;

    const tabs = ["overview", "participation", "process"];
    if (summary.is_facilitator) tabs.push("quality");

    return (
        <div className={styles.page}>
            <div className={styles.rectangleParent}>
                {/* Header */}
                <div className={styles.frameDiv}>
                    <div className={styles.rectangleDiv} />
                    <h2 className={styles.socialStudyTeammates}>Session Summary</h2>
                    <div className={styles.collaborativeLearningWith}>
                        {summary.activity_name} - Room {summary.room_code}
                    </div>
                </div>

                {/* Tab Navigation */}
                <div style={{ display: "flex", gap: 8, width: "100%" }}>
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as typeof activeTab)}
                            style={{
                                flex: 1,
                                padding: "10px",
                                border: "none",
                                borderRadius: 6,
                                background: activeTab === tab ? "#606060" : "#f2efef",
                                color: activeTab === tab ? "white" : "black",
                                cursor: "pointer",
                                fontWeight: activeTab === tab ? 600 : 400,
                            }}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className={styles.membersListParent} style={{ padding: 20 }}>
                    {activeTab === "overview" && <OverviewTab summary={summary} />}
                    {activeTab === "participation" && <ParticipationTab summary={summary} />}
                    {activeTab === "process" && <ProcessTab summary={summary} />}
                    {activeTab === "quality" && summary.quality && <QualityTab quality={summary.quality} />}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 10, width: "100%" }}>
                    <button className={styles.primaryButton} onClick={() => navigate(`/room/${code}`)}>
                        Back to Room
                    </button>
                    {summary.is_facilitator && (
                        <button className={styles.primaryButton} onClick={handleExportPDF}>
                            Export PDF
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ===== Sub-components for each tab =====

function OverviewTab({ summary }: { summary: SessionSummaryData }) {
    return (
        <div style={{ overflow: "auto", height: "100%", padding: "0 10px" }}>
            <SectionHeading>Key Decisions</SectionHeading>
            {summary.decisions.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {summary.decisions.map((d, i) => (
                        <li key={i} style={{ marginBottom: 8 }}>
                            <strong>{d.author}</strong> ({d.phase}): {d.content}
                        </li>
                    ))}
                </ul>
            ) : (
                <p style={{ opacity: 0.7, fontStyle: "italic" }}>No explicit decisions captured.</p>
            )}

            <SectionHeading>Action Items</SectionHeading>
            {summary.action_items.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {summary.action_items.map((item, i) => (
                        <li key={i} style={{ marginBottom: 8 }}>
                            <strong>{item.author}</strong>: {item.content}
                        </li>
                    ))}
                </ul>
            ) : (
                <p style={{ opacity: 0.7, fontStyle: "italic" }}>No action items identified.</p>
            )}

            <SectionHeading>Unanswered Questions</SectionHeading>
            {summary.unanswered_questions.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {summary.unanswered_questions.map((q, i) => (
                        <li key={i} style={{ marginBottom: 8 }}>
                            <strong>{q.author}</strong>: {q.content}
                        </li>
                    ))}
                </ul>
            ) : (
                <p style={{ opacity: 0.7, fontStyle: "italic" }}>All questions were addressed.</p>
            )}

            <SectionHeading>Group Outcome</SectionHeading>
            {summary.final_outcome ? (
                <blockquote style={{ borderLeft: "3px solid #606060", paddingLeft: 12, margin: "8px 0", background: "#f9f9f9", padding: "12px" }}>
                    "{summary.final_outcome.content}" - <em>{summary.final_outcome.author}</em>
                </blockquote>
            ) : (
                <p style={{ opacity: 0.7, fontStyle: "italic" }}>No final outcome recorded.</p>
            )}

            {/* Personal contribution for learners */}
            {summary.personal_contribution && (
                <>
                    <SectionHeading>Your Contribution</SectionHeading>
                    <div style={{ background: "#e8f4e8", padding: 12, borderRadius: 6 }}>
                        <p style={{ margin: "4px 0" }}><strong>Posts:</strong> {summary.personal_contribution.post_count}</p>
                        <p style={{ margin: "4px 0" }}><strong>Contribution:</strong> {summary.personal_contribution.contribution_percentage.toFixed(1)}%</p>
                        <p style={{ margin: "4px 0" }}><strong>Evidence issues:</strong> {summary.personal_contribution.lacks_evidence_count}</p>
                    </div>
                </>
            )}
        </div>
    );
}

function ParticipationTab({ summary }: { summary: SessionSummaryData }) {
    const { participation } = summary;

    return (
        <div style={{ overflow: "auto", height: "100%", padding: "0 10px" }}>
            <SectionHeading>Overview</SectionHeading>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <StatCard label="Total Posts" value={participation.total_posts} />
                <StatCard label="Total Interventions" value={participation.total_interventions} />
                <StatCard label="Turn Balance" value={`${(participation.turn_balance_score * 100).toFixed(0)}%`} />
                <StatCard label="Participants" value={participation.members.length} />
            </div>

            <SectionHeading>Per-Member Breakdown</SectionHeading>
            <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                        <tr style={{ background: "#606060", color: "white" }}>
                            <th style={{ padding: 8, textAlign: "left" }}>Name</th>
                            <th style={{ padding: 8, textAlign: "center" }}>Posts</th>
                            <th style={{ padding: 8, textAlign: "center" }}>%</th>
                            <th style={{ padding: 8, textAlign: "center" }}>Evidence Issues</th>
                        </tr>
                    </thead>
                    <tbody>
                        {participation.members.map((m) => (
                            <tr key={m.user_id} style={{ borderBottom: "1px solid #ddd" }}>
                                <td style={{ padding: 8 }}>{m.display_name}</td>
                                <td style={{ padding: 8, textAlign: "center" }}>{m.post_count}</td>
                                <td style={{ padding: 8, textAlign: "center" }}>{m.contribution_percentage.toFixed(1)}%</td>
                                <td style={{ padding: 8, textAlign: "center" }}>{m.lacks_evidence_count}</td>
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
        <div style={{ overflow: "auto", height: "100%", padding: "0 10px" }}>
            <SectionHeading>Phase Breakdown</SectionHeading>
            {process.phases.map((phase) => (
                <div key={phase.index} style={{ marginBottom: 16, padding: 12, background: "#f9f9f9", borderRadius: 6 }}>
                    <strong style={{ textTransform: "capitalize" }}>{phase.name}</strong>
                    <div style={{ display: "flex", gap: 20, marginTop: 8, fontSize: 13 }}>
                        <span>Duration: {Math.floor(phase.duration_seconds / 60)} min</span>
                        <span>Posts: {phase.post_count}</span>
                        <span>Interventions: {phase.intervention_count}</span>
                    </div>
                </div>
            ))}

            {summary.is_facilitator && process.interventions_by_rule && Object.keys(process.interventions_by_rule).length > 0 && (
                <>
                    <SectionHeading>Interventions by Type</SectionHeading>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                        <tbody>
                            {Object.entries(process.interventions_by_rule).map(([rule, count]) => (
                                <tr key={rule} style={{ borderBottom: "1px solid #ddd" }}>
                                    <td style={{ padding: 8 }}>{rule.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</td>
                                    <td style={{ padding: 8, textAlign: "right", fontWeight: 600 }}>{count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}
        </div>
    );
}

function QualityTab({ quality }: { quality: { flags: QualityFlag[]; overall_score: string } }) {
    const scoreColors: Record<string, string> = {
        good: "#4caf50",
        needs_attention: "#ff9800",
        concerning: "#f44336",
    };

    return (
        <div style={{ overflow: "auto", height: "100%", padding: "0 10px" }}>
            <SectionHeading>Overall Assessment</SectionHeading>
            <div style={{
                padding: 16,
                background: scoreColors[quality.overall_score] || "#999",
                color: "white",
                borderRadius: 6,
                textAlign: "center",
                marginBottom: 20,
                fontSize: 18,
                fontWeight: 600,
            }}>
                {quality.overall_score.replace(/_/g, " ").toUpperCase()}
            </div>

            <SectionHeading>Quality Checks</SectionHeading>
            {quality.flags.map((flag) => (
                <div
                    key={flag.code}
                    style={{
                        marginBottom: 12,
                        padding: 12,
                        background: flag.triggered ? "#ffebee" : "#e8f5e9",
                        borderRadius: 6,
                        borderLeft: `4px solid ${flag.triggered ? "#f44336" : "#4caf50"}`
                    }}
                >
                    <strong>{flag.label}</strong>
                    <span style={{
                        marginLeft: 8,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: flag.triggered ? "#f44336" : "#4caf50",
                        color: "white",
                        fontSize: 12,
                    }}>
                        {flag.triggered ? "FLAGGED" : "OK"}
                    </span>
                    <p style={{ margin: "8px 0 0 0", fontSize: 13, opacity: 0.8 }}>{flag.details}</p>
                </div>
            ))}
        </div>
    );
}

// ===== Helper components =====

function SectionHeading({ children }: { children: React.ReactNode }) {
    return (
        <h3 style={{
            marginTop: 20,
            marginBottom: 10,
            borderBottom: "1px solid #ddd",
            paddingBottom: 6,
            fontSize: 16
        }}>
            {children}
        </h3>
    );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
    return (
        <div style={{ background: "#d9d9d9", padding: 16, borderRadius: 6, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
        </div>
    );
}
