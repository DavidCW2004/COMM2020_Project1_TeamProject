import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createFacilitatorActivity } from "../api/client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

type Phase = {
    name: string;
    prompt: string;
    duration_seconds: number;
    assessment_criteria: string[];
};

type ActivityType = "problem-solving" | "discussion" | "design critique";
const ACTIVITY_TYPES: ActivityType[] = ["problem-solving", "discussion", "design critique"];

function isActivityType(v: string): v is ActivityType {
    return (ACTIVITY_TYPES as readonly string[]).includes(v);
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

export default function FacilitatorActivitiesPage() {
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [phases, setPhases] = useState<Phase[]>([
        { name: "understand", prompt: "", duration_seconds: 420, assessment_criteria: [] },
    ]);

    const [criteriaDraft, setCriteriaDraft] = useState("");
    const [globalCriteria, setGlobalCriteria] = useState<string[]>([]);

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [activityType, setActivityType] = useState<ActivityType>("discussion");

    function updatePhase(idx: number, patch: Partial<Phase>) {
        setPhases((prev) => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...patch };
            return copy;
        });
    }

    function addPhase() {
        setPhases((prev) => [
            ...prev,
            { name: "phase", prompt: "", duration_seconds: 300, assessment_criteria: [...globalCriteria] },
        ]);
    }

    function removePhase(idx: number) {
        setPhases((prev) => prev.filter((_, i) => i !== idx));
    }

    function addCriterion() {
        const t = criteriaDraft.trim();
        if (!t) return;

        setGlobalCriteria((prev) => [...prev, t]);
        setCriteriaDraft("");

        // keep phases in sync: criteria stored inside phases for backend compatibility
        setPhases((prev) =>
            prev.map((p) => ({ ...p, assessment_criteria: [...(p.assessment_criteria ?? []), t] }))
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
                assessment_criteria: p.assessment_criteria ?? [],
            })),
        };

        setBusy(true);
        try {
            const created = await createFacilitatorActivity(payload);
            setSuccess(`Created: ${created.name} (ID: ${created.id})`);
            setName("");
            setDescription("");
            setGlobalCriteria([]);
            setCriteriaDraft("");
            setPhases([{ name: "understand", prompt: "", duration_seconds: 420, assessment_criteria: [] }]);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to create activity");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-primary/10 via-muted/40 to-background text-foreground px-4 py-10">
            <div className="mx-auto w-full max-w-5xl space-y-6">
                <div className="rounded-lg border border-border bg-background/80 backdrop-blur p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                            <h1 className="text-2xl font-semibold tracking-tight">Manage activities</h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Create activities with phases, prompts, and assessment criteria
                            </p>
                        </div>

                        <Button variant="secondary" onClick={() => navigate("/facilitator")} disabled={busy}>
                            ← Back to dashboard
                        </Button>
                    </div>
                </div>

                <div
                    className="rounded-lg border border-border bg-background shadow-sm overflow-hidden flex flex-col"
                    style={{ height: "clamp(520px, 72vh, 860px)" }}
                >
                    <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Create activity</h2>
                        <span className="text-sm text-muted-foreground">
                            {phases.length} phase{phases.length === 1 ? "" : "s"}
                        </span>
                    </div>

                    <div className="flex-1 overflow-auto px-6 py-5 space-y-6">
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
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">Name</label>
                                <div className="mt-2">
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g. Root cause analysis"
                                        disabled={busy}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium">Description (optional)</label>
                                <div className="mt-2">
                                    <Textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="What is this activity for?"
                                        rows={3}
                                        disabled={busy}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium">Activity type</label>
                                <div className="mt-2">
                                    <select
                                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
                               focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="text-base font-semibold">Phases</div>
                                <Button variant="secondary" onClick={addPhase} disabled={busy}>
                                    + Add phase
                                </Button>
                            </div>

                            <div className="grid gap-3">
                                {phases.map((p, idx) => (
                                    <div key={idx} className="rounded-lg border border-border bg-background p-4">
                                        <div className="flex gap-2 flex-wrap items-start">
                                            <div className="flex-1 min-w-[200px]">
                                                <label className="text-xs text-muted-foreground">Phase name</label>
                                                <div className="mt-1">
                                                    <Input
                                                        value={p.name}
                                                        onChange={(e) => updatePhase(idx, { name: e.target.value })}
                                                        placeholder="e.g. understand"
                                                        disabled={busy}
                                                    />
                                                </div>
                                            </div>

                                            <div className="w-40">
                                                <label className="text-xs text-muted-foreground">Duration (seconds)</label>
                                                <div className="mt-1">
                                                    <Input
                                                        value={String(p.duration_seconds)}
                                                        onChange={(e) =>
                                                            updatePhase(idx, { duration_seconds: Number(e.target.value) || 0 })
                                                        }
                                                        placeholder="Seconds"
                                                        disabled={busy}
                                                    />
                                                </div>
                                            </div>

                                            <div className="pt-5">
                                                <Button
                                                    variant="secondary"
                                                    onClick={() => removePhase(idx)}
                                                    disabled={busy || phases.length <= 1}
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="mt-3">
                                            <label className="text-xs text-muted-foreground">Prompt</label>
                                            <div className="mt-1">
                                                <Textarea
                                                    value={p.prompt}
                                                    onChange={(e) => updatePhase(idx, { prompt: e.target.value })}
                                                    placeholder="What should learners do/say in this phase?"
                                                    rows={3}
                                                    disabled={busy}
                                                />
                                            </div>
                                        </div>

                                        {p.assessment_criteria?.length ? (
                                            <div className="mt-3 text-xs text-muted-foreground">
                                                Criteria attached:{" "}
                                                <span className="font-medium text-foreground">
                                                    {p.assessment_criteria.length}
                                                </span>
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Criteria */}
                        <div className="space-y-3">
                            <div className="text-base font-semibold">Assessment criteria</div>

                            <div className="flex gap-2 flex-wrap">
                                <div className="flex-1 min-w-[240px]">
                                    <Input
                                        value={criteriaDraft}
                                        onChange={(e) => setCriteriaDraft(e.target.value)}
                                        placeholder="e.g. Uses evidence to justify claims"
                                        disabled={busy}
                                    />
                                </div>
                                <Button variant="secondary" onClick={addCriterion} disabled={busy}>
                                    Add
                                </Button>
                            </div>

                            {globalCriteria.length === 0 ? (
                                <div className="text-sm text-muted-foreground">
                                    No criteria added yet.
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {globalCriteria.map((c, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1"
                                        >
                                            <span className="text-sm">{c}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeCriterion(idx)}
                                                disabled={busy}
                                                className="h-6 w-6 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground
                                   focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
                                   focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                                aria-label="Remove criterion"
                                                title="Remove"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="px-6 py-4 border-t border-border bg-background flex items-center justify-end">
                        <Button onClick={() => void submit()} disabled={busy}>
                            {busy ? "Creating…" : "Create activity"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}