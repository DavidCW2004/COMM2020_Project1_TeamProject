import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    createFacilitatorActivity,
    deleteFacilitatorActivity,
    fetchFacilitatorActivities,
    fetchFacilitatorAgents,
    updateFacilitatorActivity,
    updateFacilitatorAgent,
    type ActivityDTO,
    type AgentDTO,
} from "../../api/client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type Mode = "facilitator" | "maintainer";

type Props = {
    mode: Mode;
};

type Phase = {
    name: string;
    prompt: string;
    duration_seconds: number;
    assessment_criteria: string[];
};

type AgentSettings = {
    equity: {
        enabled: boolean;
        participation_gap: number;
    };
    inactivity: {
        enabled: boolean;
        idle_seconds: number;
    };
    evidence: {
        enabled: boolean;
        unsupported_claims_before_nudge: number;
    };
};

const DEFAULT_AGENT_SETTINGS: AgentSettings = {
    equity: {
        enabled: true,
        participation_gap: 2,
    },
    inactivity: {
        enabled: true,
        idle_seconds: 90,
    },
    evidence: {
        enabled: true,
        unsupported_claims_before_nudge: 1,
    },
};
type ActivityType = "problem-solving" | "discussion" | "design critique";

const ACTIVITY_TYPES: ActivityType[] = ["problem-solving", "discussion", "design critique"];
const PHASE_NAME_OPTIONS = ["understand", "propose", "critique", "decide"] as const;

function isActivityType(v: string): v is ActivityType {
    return (ACTIVITY_TYPES as readonly string[]).includes(v);
}

function normalizePhaseName(value: unknown): string {
    const asString = String(value ?? "").trim().toLowerCase();
    return (PHASE_NAME_OPTIONS as readonly string[]).includes(asString) ? asString : "understand";
}

function normalizeAgentSettings(raw: any): AgentSettings {
    return {
        equity: {
            enabled: raw?.equity?.enabled ?? true,
            participation_gap: Number(raw?.equity?.participation_gap) || 2,
        },
        inactivity: {
            enabled: raw?.inactivity?.enabled ?? true,
            idle_seconds: Number(raw?.inactivity?.idle_seconds) || 90,
        },
        evidence: {
            enabled: raw?.evidence?.enabled ?? true,
            unsupported_claims_before_nudge:
                Number(raw?.evidence?.unsupported_claims_before_nudge) || 1,
        },
    };
}


function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    const { className, ...rest } = props;
    return (
        <textarea
            className={[
                "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm",
                "placeholder:text-muted-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                className ?? "",
            ].join(" ")}
            {...rest}
        />
    );
}

function normalizePhases(raw: any): Phase[] {
    if (!Array.isArray(raw) || raw.length === 0) {
        return [{ name: "understand", prompt: "", duration_seconds: 420, assessment_criteria: [] }];
    }

    return raw.map((phase) => {
        const secondsFromMinutes =
            typeof phase?.time_limit_minutes === "number"
                ? Math.max(1, Math.round(phase.time_limit_minutes * 60))
                : 0;

        const durationSeconds = Number(phase?.duration_seconds) || secondsFromMinutes || 300;

        return {
            name: normalizePhaseName(phase?.name),
            prompt: String(phase?.prompt ?? ""),
            duration_seconds: durationSeconds,
            assessment_criteria: Array.isArray(phase?.assessment_criteria)
                ? phase.assessment_criteria
                : [],
        };
    });
}

function extractCriteria(phases: Phase[]): string[] {
    const out: string[] = [];
    for (const phase of phases) {
        for (const criterion of phase.assessment_criteria ?? []) {
            if (!out.includes(criterion)) out.push(criterion);
        }
    }
    return out;
}

export default function ActivityManagementView({ mode }: Props) {
    const [agentSettings, setAgentSettings] = useState<AgentSettings>(DEFAULT_AGENT_SETTINGS);

    const navigate = useNavigate();
    const isMaintainer = mode === "maintainer";
    const dashboardPath = "/facilitator";

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [phases, setPhases] = useState<Phase[]>([
        { name: "understand", prompt: "", duration_seconds: 420, assessment_criteria: [] },
    ]);
    const [criteriaDraft, setCriteriaDraft] = useState("");
    const [globalCriteria, setGlobalCriteria] = useState<string[]>([]);
    const [activityType, setActivityType] = useState<ActivityType>("discussion");

    const [activities, setActivities] = useState<ActivityDTO[]>([]);
    const [agents, setAgents] = useState<AgentDTO[]>([]);
    const [editingActivityId, setEditingActivityId] = useState<number | null>(null);

    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    async function loadManagementData() {
        setLoading(true);
        setError(null);
        try {
            const [fetchedActivities, fetchedAgents] = await Promise.all([
                fetchFacilitatorActivities(),
                fetchFacilitatorAgents(),
            ]);
            setActivities(Array.isArray(fetchedActivities) ? fetchedActivities : []);
            setAgents(Array.isArray(fetchedAgents) ? fetchedAgents : []);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load management data");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadManagementData();
    }, []);

    function resetForm() {
        setEditingActivityId(null);
        setName("");
        setDescription("");
        setActivityType("discussion");
        setGlobalCriteria([]);
        setCriteriaDraft("");
        setAgentSettings(DEFAULT_AGENT_SETTINGS);
        setPhases([{ name: "understand", prompt: "", duration_seconds: 420, assessment_criteria: [] }]);
    }

    function updatePhase(idx: number, patch: Partial<Phase>) {
        setPhases((prev) => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...patch };
            return copy;
        });
    }

    function addPhase() {
        const nextPhaseName = PHASE_NAME_OPTIONS[phases.length % PHASE_NAME_OPTIONS.length];
        setPhases((prev) => [
            ...prev,
            { name: nextPhaseName, prompt: "", duration_seconds: 300, assessment_criteria: [...globalCriteria] },
        ]);
    }

    function removePhase(idx: number) {
        setPhases((prev) => prev.filter((_, i) => i !== idx));
    }

    function addCriterion() {
        const trimmed = criteriaDraft.trim();
        if (!trimmed) return;
        setGlobalCriteria((prev) => [...prev, trimmed]);
        setCriteriaDraft("");
        setPhases((prev) =>
            prev.map((p) => ({ ...p, assessment_criteria: [...(p.assessment_criteria ?? []), trimmed] }))
        );
    }

    function removeCriterion(idx: number) {
        setGlobalCriteria((prev) => prev.filter((_, i) => i !== idx));
        setPhases((prev) =>
            prev.map((p) => ({
                ...p,
                assessment_criteria: (p.assessment_criteria ?? []).filter((_, i) => i !== idx),
            }))
        );
    }

    function beginEditActivity(activity: ActivityDTO) {
        const nextPhases = normalizePhases(activity.phases);
        const nextType = activity.activity_type;

        setEditingActivityId(activity.id);
        setName(activity.name || "");
        setDescription(activity.description || "");
        setActivityType(nextType && isActivityType(nextType) ? nextType : "discussion");
        setPhases(nextPhases);
        setGlobalCriteria(extractCriteria(nextPhases));
        setCriteriaDraft("");
        setSuccess(null);
        setError(null);
        setAgentSettings(normalizeAgentSettings(activity.agent_settings));
    }

    async function submit() {
        setError(null);
        setSuccess(null);

        const trimmedName = name.trim();
        if (trimmedName.length < 2) {
            setError("Activity name must be at least 2 characters.");
            return;
        }

        if (phases.length === 0) {
            setError("Add at least one phase.");
            return;
        }

        const invalidPhase = phases.find(
            (p) => !p.name.trim() || !p.prompt.trim() || !(p.duration_seconds > 0)
        );
        if (invalidPhase) {
            setError("Each phase must have a name, a prompt, and a positive duration.");
            return;
        }

        const payload = {
            name: trimmedName,
            description: description.trim() || null,
            activity_type: activityType,
            phases: phases.map((p) => ({
                name: p.name.trim(),
                prompt: p.prompt.trim(),
                duration_seconds: p.duration_seconds,
                time_limit_minutes: Number((p.duration_seconds / 60).toFixed(3)),
                assessment_criteria: p.assessment_criteria ?? [],
            })),
            agent_settings: agentSettings,
        };

        setBusy(true);
        try {
            if (editingActivityId) {
                const updated = await updateFacilitatorActivity(editingActivityId, payload);
                setSuccess(`Updated: ${updated.name} (ID: ${updated.id})`);
            } else {
                const created = await createFacilitatorActivity(payload);
                setSuccess(`Created: ${created.name} (ID: ${created.id})`);
            }
            resetForm();
            await loadManagementData();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save activity");
        } finally {
            setBusy(false);
        }
    }

    async function removeActivity(activity: ActivityDTO) {
        if (!isMaintainer) {
            setError("Only maintainers can delete activities.");
            return;
        }

        if (!window.confirm(`Delete activity "${activity.name}"? This cannot be undone.`)) return;

        setBusy(true);
        setError(null);
        setSuccess(null);

        try {
            await deleteFacilitatorActivity(activity.id);
            if (editingActivityId === activity.id) resetForm();
            setSuccess(`Deleted: ${activity.name}`);
            await loadManagementData();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to delete activity");
        } finally {
            setBusy(false);
        }
    }

    async function toggleAgent(agent: AgentDTO) {
        if (!isMaintainer) {
            setError("Only maintainers can enable or disable agents.");
            return;
        }

        setBusy(true);
        setError(null);
        setSuccess(null);

        try {
            await updateFacilitatorAgent(agent.id, { is_active: !agent.is_active });
            setSuccess(`${agent.name} ${agent.is_active ? "disabled" : "enabled"}.`);
            await loadManagementData();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to update agent");
        } finally {
            setBusy(false);
        }
    }

    function handleTopRightAction() {
        if (isMaintainer) {
            localStorage.removeItem("sst:user");
            navigate("/");
            return;
        }

        navigate(dashboardPath);
    }

    const topRightButtonLabel = isMaintainer ? "Log out" : "Back to dashboard";

    return (
        <div className="min-h-screen bg-gradient-to-b from-primary/10 via-muted/40 to-background text-foreground px-4 py-10">
            <div className="mx-auto w-full max-w-6xl space-y-6">
                <div className="rounded-lg border border-border bg-background/80 backdrop-blur p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                            <h1 className="text-2xl font-semibold tracking-tight">
                                {isMaintainer ? "Maintainer controls" : "Facilitator activity tools"}
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {isMaintainer
                                    ? "Manage activities and enable or disable agents."
                                    : "Create activities and review available agent support."}
                            </p>
                        </div>
                        <Button variant="secondary" onClick={handleTopRightAction} disabled={busy}>
                            {topRightButtonLabel}
                        </Button>
                    </div>
                </div>

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                        {success}
                    </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="rounded-lg border border-border bg-background shadow-sm p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">
                                {editingActivityId ? "Edit activity" : "Create activity"}
                            </h2>
                            {editingActivityId ? (
                                <Button variant="secondary" onClick={resetForm} disabled={busy}>
                                    Cancel edit
                                </Button>
                            ) : null}
                        </div>

                        <div>
                            <label className="text-sm font-medium">Name</label>
                            <div className="mt-1">
                                <Input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium">Description</label>
                            <div className="mt-1">
                                <Textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={2}
                                    disabled={busy}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium">Activity type</label>
                            <div className="mt-1">
                                <select
                                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                                    value={activityType}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        if (isActivityType(v)) setActivityType(v);
                                    }}
                                    disabled={busy}
                                >
                                    <option value="problem-solving">Problem-Solving</option>
                                    <option value="discussion">Discussion</option>
                                    <option value="design critique">Design Critique</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium">Phases</h3>
                                <Button variant="secondary" onClick={addPhase} disabled={busy}>
                                    Add phase
                                </Button>
                            </div>
                            {phases.map((p, idx) => (
                                <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <select
                                            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                                            value={normalizePhaseName(p.name)}
                                            onChange={(e) => updatePhase(idx, { name: normalizePhaseName(e.target.value) })}
                                            disabled={busy}
                                        >
                                            {PHASE_NAME_OPTIONS.map((phaseName) => (
                                                <option key={`${idx}-${phaseName}`} value={phaseName}>
                                                    {phaseName}
                                                </option>
                                            ))}
                                        </select>
                                        <Input
                                            value={String(p.duration_seconds)}
                                            onChange={(e) =>
                                                updatePhase(idx, { duration_seconds: Number(e.target.value) || 0 })
                                            }
                                            placeholder="Duration in seconds"
                                            disabled={busy}
                                        />
                                    </div>
                                    <Textarea
                                        value={p.prompt}
                                        onChange={(e) => updatePhase(idx, { prompt: e.target.value })}
                                        placeholder="Phase prompt"
                                        rows={2}
                                        disabled={busy}
                                    />
                                    <Button
                                        variant="secondary"
                                        onClick={() => removePhase(idx)}
                                        disabled={busy || phases.length <= 1}
                                    >
                                        Remove phase
                                    </Button>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <h3 className="font-medium">Assessment criteria</h3>
                            <div className="space-y-3">
                                <h3 className="font-medium">Agent settings</h3>
                                <p className="text-sm text-muted-foreground">
                                    Configure how support agents behave for this activity.
                                </p>

                                <div className="rounded-lg border border-border p-3 space-y-3">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <div className="font-medium">Equity agent</div>
                                            <div className="text-xs text-muted-foreground">
                                                Detects uneven participation.
                                            </div>
                                        </div>
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={agentSettings.equity.enabled}
                                                onChange={(e) =>
                                                    setAgentSettings((prev) => ({
                                                        ...prev,
                                                        equity: { ...prev.equity, enabled: e.target.checked },
                                                    }))
                                                }
                                                disabled={busy}
                                            />
                                            Enabled
                                        </label>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium">Participation gap threshold</label>
                                        <div className="mt-1">
                                            <Input
                                                type="number"
                                                min={1}
                                                value={String(agentSettings.equity.participation_gap)}
                                                onChange={(e) =>
                                                    setAgentSettings((prev) => ({
                                                        ...prev,
                                                        equity: {
                                                            ...prev.equity,
                                                            participation_gap: Number(e.target.value) || 1,
                                                        },
                                                    }))
                                                }
                                                disabled={busy || !agentSettings.equity.enabled}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-lg border border-border p-3 space-y-3">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <div className="font-medium">Inactivity agent</div>
                                            <div className="text-xs text-muted-foreground">
                                                Nudges inactive participants.
                                            </div>
                                        </div>
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={agentSettings.inactivity.enabled}
                                                onChange={(e) =>
                                                    setAgentSettings((prev) => ({
                                                        ...prev,
                                                        inactivity: { ...prev.inactivity, enabled: e.target.checked },
                                                    }))
                                                }
                                                disabled={busy}
                                            />
                                            Enabled
                                        </label>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium">Idle seconds before nudge</label>
                                        <div className="mt-1">
                                            <Input
                                                type="number"
                                                min={10}
                                                value={String(agentSettings.inactivity.idle_seconds)}
                                                onChange={(e) =>
                                                    setAgentSettings((prev) => ({
                                                        ...prev,
                                                        inactivity: {
                                                            ...prev.inactivity,
                                                            idle_seconds: Number(e.target.value) || 10,
                                                        },
                                                    }))
                                                }
                                                disabled={busy || !agentSettings.inactivity.enabled}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-lg border border-border p-3 space-y-3">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <div className="font-medium">Evidence agent</div>
                                            <div className="text-xs text-muted-foreground">
                                                Nudges users to support claims.
                                            </div>
                                        </div>
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={agentSettings.evidence.enabled}
                                                onChange={(e) =>
                                                    setAgentSettings((prev) => ({
                                                        ...prev,
                                                        evidence: { ...prev.evidence, enabled: e.target.checked },
                                                    }))
                                                }
                                                disabled={busy}
                                            />
                                            Enabled
                                        </label>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium">Unsupported claims before nudge</label>
                                        <div className="mt-1">
                                            <Input
                                                type="number"
                                                min={1}
                                                value={String(agentSettings.evidence.unsupported_claims_before_nudge)}
                                                onChange={(e) =>
                                                    setAgentSettings((prev) => ({
                                                        ...prev,
                                                        evidence: {
                                                            ...prev.evidence,
                                                            unsupported_claims_before_nudge:
                                                                Number(e.target.value) || 1,
                                                        },
                                                    }))
                                                }
                                                disabled={busy || !agentSettings.evidence.enabled}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    value={criteriaDraft}
                                    onChange={(e) => setCriteriaDraft(e.target.value)}
                                    placeholder="Add criterion"
                                    disabled={busy}
                                />
                                <Button variant="secondary" onClick={addCriterion} disabled={busy}>
                                    Add
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {globalCriteria.map((criterion, idx) => (
                                    <button
                                        key={`${criterion}-${idx}`}
                                        type="button"
                                        className="rounded-full border border-border px-3 py-1 text-sm"
                                        onClick={() => removeCriterion(idx)}
                                        disabled={busy}
                                        title="Click to remove"
                                    >
                                        {criterion} x
                                    </button>
                                ))}
                            </div>
                        </div>

                        <Button onClick={() => void submit()} disabled={busy}>
                            {busy ? "Saving..." : editingActivityId ? "Save changes" : "Create activity"}
                        </Button>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-lg border border-border bg-background shadow-sm p-5 space-y-3">
                            <h2 className="text-lg font-semibold">Existing activities</h2>
                            {loading ? (
                                <p className="text-sm text-muted-foreground">Loading activities...</p>
                            ) : activities.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No activities found.</p>
                            ) : (
                                <div className="space-y-2">
                                    {activities.map((activity) => (
                                        <div
                                            key={activity.id}
                                            className="rounded-lg border border-border p-3 flex items-start justify-between gap-3"
                                        >
                                            <div className="min-w-0">
                                                <p className="font-medium truncate">{activity.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {activity.activity_type || "discussion"}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="secondary"
                                                    onClick={() => beginEditActivity(activity)}
                                                    disabled={busy}
                                                >
                                                    Edit
                                                </Button>

                                                {isMaintainer ? (
                                                    <Button
                                                        variant="secondary"
                                                        onClick={() => void removeActivity(activity)}
                                                        disabled={busy}
                                                    >
                                                        Delete
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="rounded-lg border border-border bg-background shadow-sm p-5 space-y-3">
                            <h2 className="text-lg font-semibold">Agent status</h2>
                            {loading ? (
                                <p className="text-sm text-muted-foreground">Loading agents...</p>
                            ) : agents.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No agents found.</p>
                            ) : (
                                <div className="space-y-2">
                                    {agents.map((agent) => (
                                        <div
                                            key={agent.id}
                                            className="rounded-lg border border-border p-3 flex items-start justify-between gap-3"
                                        >
                                            <div className="min-w-0">
                                                <p className="font-medium">{agent.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {agent.description || "No description"}
                                                </p>
                                                <p className="text-xs mt-1">
                                                    Status:{" "}
                                                    <span className={agent.is_active ? "text-emerald-700" : "text-amber-700"}>
                                                        {agent.is_active ? "Enabled" : "Disabled"}
                                                    </span>
                                                </p>
                                            </div>
                                            {isMaintainer ? (
                                                <Button
                                                    variant="secondary"
                                                    onClick={() => void toggleAgent(agent)}
                                                    disabled={busy}
                                                >
                                                    {agent.is_active ? "Disable" : "Enable"}
                                                </Button>
                                            ) : (
                                                <span className="text-xs text-muted-foreground self-center">
                                                    Read only
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}