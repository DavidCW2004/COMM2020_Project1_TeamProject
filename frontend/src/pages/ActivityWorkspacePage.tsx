import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import styles from "../styles/Login.module.css";
import Modal from "../components/Modal";

type ActivityState = {
    is_running: boolean;
    finished: boolean;
    activity_id: number | null;
    activity_name: string | null;
    phase_index?: number | null;
    phase_name?: string | null;
    phase_prompt?: string | null;
    phase_ends_at?: string | null;
    total_phases?: number | null;
    activity_run_id?: string | null;
};

type MessageItem =
    | {
        type: "post";
        id: number;
        content: string;
        author: string;
        created_at: string;
        phase_index: number | null;
        lacks_evidence?: boolean;
    }
    | {
        type: "intervention";
        id: number;
        content: string;
        author: string;
        explanation: string;
        rule_name: string;
        created_at: string;
        phase_index: number | null;
    };


type MessagesResponse = {
    room: string;
    phase_index: number | null;
    activity: ActivityState;
    messages: MessageItem[];
};

function secondsLeft(iso?: string | null) {
    if (!iso) return null;
    const end = new Date(iso).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((end - now) / 1000));
}

export default function ActivityWorkspacePage() {
    const { code } = useParams<{ code: string }>();

    const pollRef = useRef<number | null>(null);
    const [activity, setActivity] = useState<ActivityState | null>(null);
    const [phaseIndex, setPhaseIndex] = useState<number | null>(null);
    const [messages, setMessages] = useState<MessageItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const pageLoadedAtRef = useRef<number>(Date.now());
    const [showWhy, setShowWhy] = useState(false);




    const [input, setInput] = useState("");
    const [timer, setTimer] = useState<number | null>(null);

    const seenInterventionsRef = useRef<Set<number>>(new Set());
    const [interventionQueue, setInterventionQueue] = useState<
        Extract<MessageItem, { type: "intervention" }>[]
    >([]);
    const [activeIntervention, setActiveIntervention] = useState<
        Extract<MessageItem, { type: "intervention" }> | null
    >(null);

    async function fetchStateAndMessages() {
        if (!code) return;

        const res = await fetch(`/api/messages/?room=${encodeURIComponent(code)}`, {
            credentials: "include",
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to load messages (${res.status}): ${text}`);
        }

        const data: MessagesResponse = await res.json();

        setActivity(data.activity);

        const postsOnly = data.messages.filter(
            (m): m is Extract<MessageItem, { type: "post" }> => m.type === "post"
        );
        setMessages(postsOnly);

        const interventions = data.messages.filter(
            (m): m is Extract<MessageItem, { type: "intervention" }> => m.type === "intervention"
        );

        const freshInterventions = interventions.filter((i) => {
            const created = new Date(i.created_at).getTime();
            return created >= pageLoadedAtRef.current;
        });

        const newlyArrived = freshInterventions.filter(
            (i) => !seenInterventionsRef.current.has(i.id)
        );

        if (newlyArrived.length) {
            newlyArrived.forEach((i) => seenInterventionsRef.current.add(i.id));
            setInterventionQueue((q) => [...q, ...newlyArrived]);
        }

        if (data.phase_index !== phaseIndex) {
            setPhaseIndex(data.phase_index ?? null);
        }

        setTimer(secondsLeft(data.activity.phase_ends_at));
    }

    useEffect(() => {
        if (activeIntervention) return;
        if (interventionQueue.length === 0) return;

        setShowWhy(false); 
        setActiveIntervention(interventionQueue[0]);
        setInterventionQueue((q) => q.slice(1));
    }, [interventionQueue, activeIntervention]);


    useEffect(() => {
        if (activeIntervention) return;
        if (interventionQueue.length === 0) return;

        setActiveIntervention(interventionQueue[0]);
        setInterventionQueue((q) => q.slice(1));
    }, [interventionQueue, activeIntervention]);

    useEffect(() => {
        let cancelled = false;

        async function initialLoad() {
            try {
                setLoading(true);
                setError(null);
                await fetchStateAndMessages();
            } catch (e: any) {
                if (!cancelled) setError(e.message ?? "Failed to load activity");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        initialLoad();

        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = window.setInterval(() => {
            fetchStateAndMessages().catch((e) => setError(e.message ?? "Failed to poll"));
        }, 2000);

        return () => {
            cancelled = true;
            if (pollRef.current) window.clearInterval(pollRef.current);
            pollRef.current = null;
        };
    }, [code]);

    useEffect(() => {
        if (!activity?.phase_ends_at) return;

        const id = window.setInterval(() => {
            setTimer(secondsLeft(activity.phase_ends_at));
        }, 1000);

        return () => window.clearInterval(id);
    }, [activity?.phase_ends_at]);


    async function sendMessage() {
        if (!code) return;
        const content = input.trim();
        if (!content) return;

        try {
            const res = await fetch(`/api/messages/?room=${encodeURIComponent(code)}`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            });

            // If backend blocks the message and returns an intervention payload:
            if (res.status === 422) {
                const intervention = await res.json();

                setInterventionQueue((q) => [...q, intervention]);
                // Clear input because it was "handled"
                setInput("");
                return;
            }

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Failed to send (${res.status}): ${text}`);
            }

            setInput("");
            await fetchStateAndMessages();
        } catch (e: any) {
            setError(e.message ?? "Failed to send message");
        }
    }


    const phaseLabel =
        activity?.finished ? "Finished" : activity?.phase_name ?? "Lobby";

    return (
        <div className={styles.page}>
            <div className={styles.rectangleParent}>
                <div className={styles.frameDiv}>
                    <div className={styles.rectangleDiv} />
                    <h2 className={styles.socialStudyTeammates}>
                        {activity?.activity_name ?? "Activity"}
                    </h2>
                    <div className={styles.collaborativeLearningWith}>
                        Room: {code ?? ""} • Phase: {phaseLabel}
                        {timer !== null && !activity?.finished && ` • ${timer}s left`}
                    </div>
                </div>

                <div className={styles.membersListParent} style={{ display: "flex", flexDirection: "column" }}>
                    <div className={styles.membersHeading}>Prompt</div>
                    <div style={{ padding: 12, opacity: 0.9 }}>
                        {activity?.phase_prompt ?? "Waiting…"}
                    </div>

                    <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
                        {loading && <div>Loading…</div>}
                        {error && <div style={{ color: "crimson" }}>{error}</div>}
                        {!loading && messages.length === 0 && <div>No messages yet.</div>}

                        {messages.map((m) => (
                            <div key={`${m.type}-${m.id}`} style={{ marginBottom: 10 }}>
                                <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                                    {m.author}
                                    <span style={{ fontWeight: 400, opacity: 0.7, fontSize: 12 }}>
                                        {new Date(m.created_at).toLocaleTimeString()}
                                    </span>

                                    {m.type === "post" && m.lacks_evidence && (
                                        <span
                                            style={{
                                                fontSize: 12,
                                                padding: "2px 8px",
                                                borderRadius: 999,
                                                border: "1px solid #d9a300",
                                                background: "rgba(217,163,0,0.12)",
                                            }}
                                            title="This message doesn’t include evidence, a source, numbers, or clear reasoning."
                                        >
                                            Lacks evidence
                                        </span>
                                    )}
                                </div>

                                <div style={{ opacity: 0.9 }}>{m.content}</div>

                                {m.type === "intervention" && (
                                    <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
                                        Rule: {m.rule_name} • {m.explanation}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div style={{ display: "flex", gap: 10, padding: 12 }}>
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={activity?.finished ? "Activity finished" : "Write a message…"}
                            disabled={!!activity?.finished}
                            style={{ flex: 1, height: 38, padding: "0 10px", borderRadius: 6, border: "1px solid #ccc" }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") sendMessage();
                            }}
                        />
                        <button
                            className={styles.primaryButton}
                            type="button"
                            onClick={sendMessage}
                            disabled={!!activity?.finished}
                        >
                            Send
                        </button>
                    </div>

                    <Modal
                        isOpen={!!activeIntervention}
                        onClose={() => {
                            setActiveIntervention(null);
                            setShowWhy(false);
                        }}
                        footer={
                            <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
                                {/* Left side: toggle/back */}
                                {!showWhy ? (
                                    <button
                                        type="button"
                                        onClick={() => setShowWhy(true)}
                                        style={{
                                            height: 38,
                                            padding: "0 14px",
                                            borderRadius: 6,
                                            border: "1px solid #ccc",
                                            background: "white",
                                            cursor: "pointer",
                                        }}
                                    >
                                        Why am I seeing this?
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setShowWhy(false)}
                                        style={{
                                            height: 38,
                                            padding: "0 14px",
                                            borderRadius: 6,
                                            border: "1px solid #ccc",
                                            background: "white",
                                            cursor: "pointer",
                                        }}
                                    >
                                        Back
                                    </button>
                                )}

                                {/* Right side: next/ok */}
                                <div style={{ display: "flex", gap: 10 }}>
                                    {interventionQueue.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                // Close current; effect opens next
                                                setActiveIntervention(null);
                                                setShowWhy(false);
                                            }}
                                            style={{
                                                height: 38,
                                                padding: "0 14px",
                                                borderRadius: 6,
                                                border: "1px solid #ccc",
                                                background: "white",
                                                cursor: "pointer",
                                            }}
                                        >
                                            Next ({interventionQueue.length})
                                        </button>
                                    )}

                                    <button
                                        className={styles.primaryButton}
                                        type="button"
                                        onClick={() => {
                                            setActiveIntervention(null);
                                            setShowWhy(false);
                                        }}
                                    >
                                        OK
                                    </button>
                                </div>
                            </div>
                        }
                    >
                        {activeIntervention && (
                            <div>
                                <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>
                                    {showWhy ? "Why am I seeing this?" : activeIntervention.author}
                                </div>

                                {!showWhy ? (
                                    <div style={{ opacity: 0.95 }}>
                                        {activeIntervention.content}
                                    </div>
                                ) : (
                                    <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
                                        {activeIntervention.explanation}

                                        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.6 }}>
                                            Rule: {activeIntervention.rule_name}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </Modal>




                </div>
            </div>
        </div>
    );
}
