import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/Login.module.css";
import { createFacilitatorActivity } from "../api/client";

type Phase = {
    name: string;
    prompt: string;
    duration_seconds: number;
    assessment_criteria: string[];
};

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
        setPhases((prev) => prev.map((p) => ({ ...p, assessment_criteria: [...(p.assessment_criteria ?? []), t] })));
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
        const invalidPhase = phases.find((p) => !p.name.trim() || !p.prompt.trim() || !(p.duration_seconds > 0));
        if (invalidPhase) {
            setError("Each phase must have a name, a prompt, and a positive duration.");
            return;
        }

        // Payload matches your ActivitySerializer fields
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

    type ActivityType = "problem-solving" | "discussion" | "design critique";
    const ACTIVITY_TYPES: ActivityType[] = ["problem-solving", "discussion", "design critique"];
    const [activityType, setActivityType] = useState<ActivityType>("discussion");

    function isActivityType(v: string): v is ActivityType {
        return (ACTIVITY_TYPES as readonly string[]).includes(v);
    }

    return (
        <div className={styles.page}>
            <div className={styles.rectangleParent}>
                <div className={styles.frameDiv}>
                    <div className={styles.rectangleDiv} />
                    <h2 className={styles.socialStudyTeammates}>Manage Activities</h2>
                    <div className={styles.collaborativeLearningWith}>
                        Create activities with phases, prompts, and assessment criteria
                    </div>
                </div>

                <div
                    className={styles.membersListParent}
                    style={{
                        width: "100%",
                        padding: 12,
                        boxSizing: "border-box",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 10 }}>Create Activity</div>
                    <div
                        style={{
                            flex: 1,
                            overflowY: "auto",
                            paddingRight: 6,
                        }}
                    >
                        {error && <div className={styles.error}>{error}</div>}
                        {success && <div style={{ textAlign: "center", opacity: 0.9 }}>{success}</div>}

                        <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Name</label>
                        <input
                            className={styles.searchInput}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Root cause analysis"
                            style={{ marginBottom: 10 }}
                        />

                        <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Description (optional)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What is this activity for?"
                            style={{
                                width: "100%",
                                minHeight: 70,
                                borderRadius: 6,
                                border: "1px solid #cfcfcf",
                                padding: 10,
                                marginBottom: 10,
                                boxSizing: "border-box",
                            }}
                        />

                        <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Activity type</label>
                        <select
                            className={styles.searchInput}
                            value={activityType}
                            onChange={(e) => {
                                const v = e.target.value;
                                if (isActivityType(v)) setActivityType(v);
                            }}
                            style={{ marginBottom: 12, height: 36 }}
                        >
                            <option value="problem-solving">Problem-Solving</option>
                            <option value="discussion">Discussion</option>
                            <option value="design critique">Design Critique</option>
                        </select>

                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Phases</div>

                        <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
                            {phases.map((p, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        background: "#f2efef",
                                        border: "1px solid #cfcfcf",
                                        borderRadius: 10,
                                        padding: 10,
                                    }}
                                >
                                    <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                                        <input
                                            className={styles.searchInput}
                                            value={p.name}
                                            onChange={(e) => updatePhase(idx, { name: e.target.value })}
                                            placeholder="Phase name"
                                            style={{ height: 32 }}
                                        />
                                        <input
                                            className={styles.searchInput}
                                            value={String(p.duration_seconds)}
                                            onChange={(e) => updatePhase(idx, { duration_seconds: Number(e.target.value) || 0 })}
                                            placeholder="Seconds"
                                            style={{ width: 120, height: 32 }}
                                        />
                                        <button
                                            className={styles.primaryButton}
                                            type="button"
                                            style={{ width: 90, height: 32 }}
                                            onClick={() => removePhase(idx)}
                                            disabled={busy || phases.length <= 1}
                                        >
                                            Remove
                                        </button>
                                    </div>

                                    <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Prompt</label>
                                    <textarea
                                        value={p.prompt}
                                        onChange={(e) => updatePhase(idx, { prompt: e.target.value })}
                                        placeholder="What should learners do/say in this phase?"
                                        style={{
                                            width: "100%",
                                            minHeight: 60,
                                            borderRadius: 6,
                                            border: "1px solid #cfcfcf",
                                            padding: 10,
                                            boxSizing: "border-box",
                                        }}
                                    />
                                </div>
                            ))}
                        </div>

                        <button
                            className={styles.primaryButton}
                            type="button"
                            style={{ height: 36, width: "100%", marginBottom: 12 }}
                            onClick={addPhase}
                            disabled={busy}
                        >
                            + Add phase
                        </button>

                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Assessment criteria</div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                            <input
                                className={styles.searchInput}
                                value={criteriaDraft}
                                onChange={(e) => setCriteriaDraft(e.target.value)}
                                placeholder="e.g. Uses evidence to justify claims"
                                style={{ height: 36 }}
                            />
                            <button
                                className={styles.primaryButton}
                                type="button"
                                style={{ width: 120, height: 36 }}
                                onClick={addCriterion}
                                disabled={busy}
                            >
                                Add
                            </button>
                        </div>

                        {globalCriteria.length === 0 ? (
                            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>No criteria added yet.</div>
                        ) : (
                            <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
                                {globalCriteria.map((c, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            background: "#f2efef",
                                            border: "1px solid #cfcfcf",
                                            borderRadius: 10,
                                            padding: "8px 10px",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            gap: 8,
                                        }}
                                    >
                                        <span style={{ fontSize: 13 }}>{c}</span>
                                        <button
                                            className={styles.primaryButton}
                                            type="button"
                                            style={{ width: 90, height: 32 }}
                                            onClick={() => removeCriterion(idx)}
                                            disabled={busy}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <button
                            className={styles.primaryButton}
                            type="button"
                            style={{ height: 36, width: "100%" }}
                            onClick={() => void submit()}
                            disabled={busy}
                        >
                            {busy ? "Creating…" : "Create activity"}
                        </button>

                    </div>
                </div>
                <button
                    className={styles.primaryButton}
                    type="button"
                    style={{ height: 36, width: "100%", marginTop: 10 }}
                    onClick={() => navigate("/facilitator")}
                    disabled={busy}
                >
                    ← Back to dashboard
                </button>
            </div>
        </div>
    );
}
