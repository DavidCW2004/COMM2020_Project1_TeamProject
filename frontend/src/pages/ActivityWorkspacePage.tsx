import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Modal from "../components/Modal";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

type ActivityState = {
    is_running: boolean;
    finished: boolean;
    is_paused?: boolean;
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

type FinalAnswerPost = {
    id: number;
    content: string;
    author: string;
    created_at: string;
    votes: number;
    is_final: boolean;
};

type FinalAnswerState = {
    majority_needed: number;
    final_answer_post_id: number | null;
    user_vote_post_id: number | null;
    posts: FinalAnswerPost[];
};

function secondsLeft(iso?: string | null) {
    if (!iso) return null;
    const end = new Date(iso).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((end - now) / 1000));
}

export default function ActivityWorkspacePage() {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();

    const pollRef = useRef<number | null>(null);

    const [activity, setActivity] = useState<ActivityState | null>(null);
    const [phaseIndex, setPhaseIndex] = useState<number | null>(null);
    const [messages, setMessages] = useState<Extract<MessageItem, { type: "post" }>[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const pageLoadedAtRef = useRef<number>(Date.now());

    const [input, setInput] = useState("");
    const [timer, setTimer] = useState<number | null>(null);

    const [finalAnswer, setFinalAnswer] = useState<FinalAnswerState | null>(null);
    const [finalAnswerLoading, setFinalAnswerLoading] = useState(false);
    const [finalAnswerError, setFinalAnswerError] = useState<string | null>(null);

    const seenInterventionsRef = useRef<Set<number>>(new Set());
    const [interventionQueue, setInterventionQueue] = useState<
        Extract<MessageItem, { type: "intervention" }>[]
    >([]);
    const [activeIntervention, setActiveIntervention] = useState<
        Extract<MessageItem, { type: "intervention" }> | null
    >(null);
    const [showWhy, setShowWhy] = useState(false);

    const scrollRef = useRef<HTMLDivElement | null>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const shouldAutoScrollRef = useRef(true);

    const finalAnswerPollRef = useRef<number | null>(null);


    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const onScroll = () => {
            const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            shouldAutoScrollRef.current = distanceFromBottom < 120;
        };

        el.addEventListener("scroll", onScroll);
        onScroll();
        return () => el.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        if (!shouldAutoScrollRef.current) return;
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

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

        const newlyArrived = freshInterventions.filter((i) => !seenInterventionsRef.current.has(i.id));

        if (newlyArrived.length) {
            newlyArrived.forEach((i) => seenInterventionsRef.current.add(i.id));
            setInterventionQueue((q) => [...q, ...newlyArrived]);
        }

        if (data.phase_index !== phaseIndex) {
            setPhaseIndex(data.phase_index ?? null);
        }

        setTimer(data.activity.is_paused ? null : secondsLeft(data.activity.phase_ends_at));
    }

    async function fetchFinalAnswer(activityRunId?: string | null, options?: { silent?: boolean }) {
        if (!code || !activityRunId) return;

        const silent = options?.silent ?? false;

        try {
            if (!silent) {
                setFinalAnswerLoading(true);
            }
            setFinalAnswerError(null);

            const params = new URLSearchParams({ activity_run_id: activityRunId });
            const res = await fetch(
                `/api/rooms/${encodeURIComponent(code)}/final-answer/?${params.toString()}`,
                { credentials: "include" }
            );

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail || "Failed to load final answer options");
            }

            const data = await res.json();
            setFinalAnswer(data);
        } catch (e: any) {
            setFinalAnswerError(e.message ?? "Failed to load final answer options");
        } finally {
            if (!silent) {
                setFinalAnswerLoading(false);
            }
        }
    }

    // Intervention queue advance
    useEffect(() => {
        if (activeIntervention) return;
        if (interventionQueue.length === 0) return;

        setShowWhy(false);
        setActiveIntervention(interventionQueue[0]);
        setInterventionQueue((q) => q.slice(1));
    }, [interventionQueue, activeIntervention]);

    // Poll messages
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

        void initialLoad();

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

    //countdown tick
    useEffect(() => {
        if (!activity?.phase_ends_at || activity?.is_paused) {
            return;
        }

        const id = window.setInterval(() => {
            setTimer(secondsLeft(activity.phase_ends_at));
        }, 1000);

        return () => window.clearInterval(id);
    }, [activity?.phase_ends_at, activity?.is_paused]);

    // Load final answer options after finish
    useEffect(() => {
        if (!activity?.finished || !activity.activity_run_id) {
            if (finalAnswerPollRef.current) {
                window.clearInterval(finalAnswerPollRef.current);
                finalAnswerPollRef.current = null;
            }
            return;
        }

        void fetchFinalAnswer(activity.activity_run_id);

        if (finalAnswerPollRef.current) {
            window.clearInterval(finalAnswerPollRef.current);
        }

        finalAnswerPollRef.current = window.setInterval(() => {
            fetchFinalAnswer(activity.activity_run_id!, { silent: true }).catch((e) => {
                setFinalAnswerError(e.message ?? "Failed to poll final answer");
            });
        }, 1500);

        return () => {
            if (finalAnswerPollRef.current) {
                window.clearInterval(finalAnswerPollRef.current);
                finalAnswerPollRef.current = null;
            }
        };
    }, [activity?.finished, activity?.activity_run_id]);
    async function sendMessage() {
        if (!code) return;
        if (activity?.is_paused) return;
        const content = input.trim();
        if (!content) return;

        try {
            const res = await fetch(`/api/messages/?room=${encodeURIComponent(code)}`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            });

            if (res.status === 422) {
                const intervention = await res.json();
                setInterventionQueue((q) => [...q, intervention]);
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

    async function handleVote(postId: number) {
        if (!code || !activity?.activity_run_id) return;

        try {
            setFinalAnswerLoading(true);
            setFinalAnswerError(null);

            const res = await fetch(`/api/rooms/${encodeURIComponent(code)}/final-answer/`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "vote", post_id: postId }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail || "Failed to cast vote");
            }

            await fetchFinalAnswer(activity.activity_run_id);
        } catch (e: any) {
            setFinalAnswerError(e.message ?? "Failed to cast vote");
        } finally {
            setFinalAnswerLoading(false);
        }
    }

    const phaseLabel = activity?.finished ? "Finished" : activity?.phase_name ?? "Lobby";

    return (
        <div className="min-h-screen bg-gradient-to-b from-primary/10 via-muted/40 to-background text-foreground px-4 py-10">
            <div className="mx-auto w-full max-w-5xl space-y-6">
                <div className="rounded-lg border border-border bg-background/80 backdrop-blur p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                            <h1 className="text-2xl font-semibold tracking-tight truncate">
                                {activity?.activity_name ?? "Activity"}
                            </h1>

                            <p className="mt-1 text-sm text-muted-foreground">
                                Room: <span className="font-medium text-foreground">{code ?? ""}</span>{" "}
                                • Phase: <span className="font-medium text-foreground">{phaseLabel}</span>

                                {activity?.is_paused ? (
                                    <span className="ml-2 text-xs rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-amber-800">
                                        Paused
                                    </span>
                                ) : timer !== null && !activity?.finished ? (
                                    <span className="ml-2 text-xs rounded-full border border-border bg-muted/40 px-2 py-0.5">
                                        {timer}s left
                                    </span>
                                ) : null}
                            </p>
                        </div>

                        <div className="flex gap-2">
                            {activity?.finished ? (
                                <>
                                    <Button variant="secondary" onClick={() => navigate(`/room/${code}`)}>
                                        Back to room
                                    </Button>
                                    <Button onClick={() => navigate(`/room/${code}/summary`)}>
                                        View summary
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    variant="secondary"
                                    onClick={() =>
                                        navigate(`/rooms`)
                                    }
                                >
                                    Exit workspace
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border border-border bg-background p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <h2 className="text-lg font-semibold">Prompt</h2>
                        <span className="text-xs rounded-full border border-border bg-muted/40 px-2 py-1 text-muted-foreground">
                            Phase {((activity?.phase_index ?? 0) + 1)}/{activity?.total_phases ?? "?"}
                        </span>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                        {activity?.phase_prompt ?? "Waiting…"}
                    </p>
                </div>

                <div
                    className="rounded-lg border border-border bg-background shadow-sm overflow-hidden flex flex-col"
                    style={{ height: "clamp(420px, 65vh, 760px)" }}
                >
                    <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Workspace</h2>
                        <span className="text-sm text-muted-foreground">
                            {loading ? "Loading…" : `${messages.length} messages`}
                        </span>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-auto px-6 py-4 space-y-4">
                        {activity?.is_paused && (
                            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                This activity is currently paused by the facilitator.
                            </div>
                        )}
                        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}

                        {error && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        {!loading && !activity?.finished && messages.length === 0 && (
                            <div className="text-sm text-muted-foreground">No messages yet.</div>
                        )}

                        {messages.map((m) => (
                            <div key={`post-${m.id}`} className="rounded-lg border border-border bg-muted/20 p-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="font-semibold">{m.author}</div>
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(m.created_at).toLocaleTimeString()}
                                    </span>

                                    {m.lacks_evidence && (
                                        <span
                                            className="text-xs rounded-full border border-amber-300 bg-amber-200/30 px-2 py-0.5"
                                            title="This message doesn’t include evidence, a source, numbers, or clear reasoning."
                                        >
                                            Lacks evidence
                                        </span>
                                    )}
                                </div>

                                <div className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{m.content}</div>
                            </div>
                        ))}

                        {activity?.finished && (
                            <div className="mt-4 space-y-3">
                                <h3 className="text-lg font-semibold">Choose final conclusion</h3>

                                {finalAnswerError && (
                                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                        {finalAnswerError}
                                    </div>
                                )}

                                {finalAnswerLoading && !finalAnswer && (
                                    <div className="text-sm text-muted-foreground">Loading options…</div>
                                )}

                                {!finalAnswerLoading && finalAnswer?.posts?.length === 0 && (
                                    <div className="text-sm text-muted-foreground italic">
                                        No messages were posted in the decide phase.
                                    </div>
                                )}

                                {finalAnswer?.posts?.length ? (
                                    <div className="grid gap-3">
                                        {finalAnswer.posts.map((post) => {
                                            const isUserVote = finalAnswer.user_vote_post_id === post.id;
                                            const isFinal = finalAnswer.final_answer_post_id === post.id;

                                            return (
                                                <div
                                                    key={post.id}
                                                    className={[
                                                        "rounded-lg border p-4",
                                                        isFinal ? "border-emerald-200 bg-emerald-50" : "border-border bg-background",
                                                    ].join(" ")}
                                                >
                                                    <div className="font-semibold">{post.author}</div>
                                                    <div className="mt-2 text-sm whitespace-pre-wrap">{post.content}</div>

                                                    <div className="mt-3 flex items-center gap-3 flex-wrap">
                                                        <span className="text-xs text-muted-foreground">
                                                            {post.votes} / {finalAnswer.majority_needed || "majority"} votes
                                                        </span>

                                                        {!isFinal ? (
                                                            <Button
                                                                variant={isUserVote ? "secondary" : "primary"}
                                                                onClick={() => handleVote(post.id)}
                                                                disabled={finalAnswerLoading}
                                                            >
                                                                {isUserVote ? "Voted" : "Vote"}
                                                            </Button>
                                                        ) : (
                                                            <span className="text-xs font-semibold text-emerald-700">Finalised</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : null}
                            </div>
                        )}

                        <div ref={bottomRef} />
                    </div>

                    <div className="px-6 py-4 border-t border-border bg-background">
                        {activity?.finished ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <Button variant="secondary" onClick={() => navigate(`/room/${code}/summary`)}>
                                    View session summary
                                </Button>
                                <Button onClick={() => navigate(`/room/${code}`)}>Back to room</Button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <Input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder={activity?.is_paused ? "Activity is paused…" : "Write a message…"}
                                    disabled={activity?.is_paused}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !activity?.is_paused) sendMessage();
                                    }}
                                />
                                <Button onClick={sendMessage} disabled={activity?.is_paused}>
                                    Send
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <Modal
                    isOpen={!!activeIntervention}
                    onClose={() => {
                        setActiveIntervention(null);
                        setShowWhy(false);
                    }}
                    footer={
                        <>
                            {!showWhy ? (
                                <Button variant="secondary" type="button" onClick={() => setShowWhy(true)}>
                                    Why am I seeing this?
                                </Button>
                            ) : (
                                <Button variant="secondary" type="button" onClick={() => setShowWhy(false)}>
                                    Back
                                </Button>
                            )}

                            <div className="flex gap-2">
                                {interventionQueue.length > 0 && (
                                    <Button
                                        variant="secondary"
                                        type="button"
                                        onClick={() => {
                                            setActiveIntervention(null);
                                            setShowWhy(false);
                                        }}
                                    >
                                        Next ({interventionQueue.length})
                                    </Button>
                                )}

                                <Button
                                    type="button"
                                    onClick={() => {
                                        setActiveIntervention(null);
                                        setShowWhy(false);
                                    }}
                                >
                                    OK
                                </Button>
                            </div>
                        </>
                    }
                >
                    {activeIntervention && (
                        <div className="space-y-3">
                            <div className="font-semibold text-base">
                                {showWhy ? "Why am I seeing this?" : activeIntervention.author}
                            </div>

                            {!showWhy ? (
                                <div className="text-sm leading-relaxed whitespace-pre-wrap">{activeIntervention.content}</div>
                            ) : (
                                <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                    {activeIntervention.explanation}
                                    <div className="mt-3 text-xs text-muted-foreground/80">
                                        Rule: {activeIntervention.rule_name}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </Modal>
            </div>
        </div>
    );
}