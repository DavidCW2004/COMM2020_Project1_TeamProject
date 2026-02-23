import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchRoom } from "../api/client";
import Modal from "../components/Modal";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";

type Phase = {
    name: string;
    prompt: string;
    time_limit_minutes: number;
    turn_limit: number;
};

type Activity = {
    id: number;
    name: string;
    description: string;
    activity_type: string;
    phases: Phase[];
    created_at: string;
};

type Room = {
    code: string;
    name: string;
};

export default function ActivityCataloguePage() {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();

    const [room, setRoom] = useState<Room | null>(null);

    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<"all" | Activity["activity_type"]>("all");

    const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [selecting, setSelecting] = useState(false);
    const [selectError, setSelectError] = useState<string | null>(null);

    const filteredActivities = useMemo(() => {
        const q = query.trim().toLowerCase();
        return activities.filter((a) => {
            const matchesQuery =
                !q ||
                a.name.toLowerCase().includes(q) ||
                (a.description ?? "").toLowerCase().includes(q);

            const matchesType = typeFilter === "all" || a.activity_type === typeFilter;

            return matchesQuery && matchesType;
        });
    }, [activities, query, typeFilter]);

    function openActivityModal(activity: Activity) {
        setSelectError(null);
        setSelectedActivity(activity);
        setIsModalOpen(true);
    }

    function closeActivityModal() {
        if (selecting) return;
        setIsModalOpen(false);
        setSelectedActivity(null);
        setSelectError(null);
    }

    async function confirmSelectActivity() {
        if (!selectedActivity || !code) return;

        try {
            setSelecting(true);
            setSelectError(null);

            const res = await fetch(`/api/rooms/${code}/select-activity/`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activity_id: selectedActivity.id }),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Failed to select activity (${res.status}): ${text}`);
            }

            closeActivityModal();
            navigate(`/room/${code}`);
        } catch (e: any) {
            setSelectError(e?.message ?? "Failed to select activity");
        } finally {
            setSelecting(false);
        }
    }

    useEffect(() => {
        if (!code) return;

        fetchRoom(code)
            .then(setRoom)
            .catch((err) => {
                setError(err instanceof Error ? err.message : "Failed to load room");
            });
    }, [code]);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                setLoading(true);
                setError(null);

                const res = await fetch("/api/activities/", {
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                });

                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`Failed to load activities (${res.status}): ${text}`);
                }

                const data: Activity[] = await res.json();
                if (!cancelled) setActivities(data);
            } catch (e: any) {
                if (!cancelled) setError(e?.message ?? "Unknown error");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void load();
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-b from-primary/10 via-muted/40 to-background text-foreground px-4 py-10">
            <div className="mx-auto w-full max-w-5xl space-y-6">
                <div className="rounded-lg border border-border bg-background/80 backdrop-blur p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                            <h1 className="text-2xl font-semibold tracking-tight truncate">
                                {room ? room.name : "Loading…"}
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Code: <span className="font-medium text-foreground">{code ?? ""}</span>
                            </p>
                        </div>

                        <Button variant="secondary" onClick={() => navigate(`/room/${code}`)}>
                            Back to room
                        </Button>
                    </div>

                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search activities…"
                            aria-label="Search activities"
                        />

                        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
                            <SelectTrigger className="sm:w-56">
                                <SelectValue placeholder="All types" />
                            </SelectTrigger>

                            <SelectContent>
                                <SelectItem value="all">All types</SelectItem>
                                <SelectItem value="problem-solving">Problem-Solving</SelectItem>
                                <SelectItem value="discussion">Discussion</SelectItem>
                                <SelectItem value="design critique">Design Critique</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="rounded-lg border border-border bg-background p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <h2 className="text-lg font-semibold">Activity catalogue</h2>
                        <div className="text-sm text-muted-foreground">
                            {loading ? "Loading…" : `${filteredActivities.length} shown`}
                        </div>
                    </div>

                    <div className="mt-4">
                        {loading && (
                            <div className="space-y-3">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="rounded-lg border border-border bg-background p-4">
                                        <div className="h-5 w-2/3 bg-muted rounded" />
                                        <div className="mt-3 h-4 w-5/6 bg-muted rounded" />
                                        <div className="mt-2 h-4 w-2/6 bg-muted rounded" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {error && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        {!loading && !error && activities.length === 0 && (
                            <div className="rounded-lg border border-border bg-muted/40 p-8 text-center">
                                <div className="text-base font-semibold">No activities available</div>
                                <div className="mt-2 text-sm text-muted-foreground">
                                    Ask a facilitator to create one.
                                </div>
                            </div>
                        )}

                        {!loading && !error && filteredActivities.length === 0 && activities.length > 0 && (
                            <div className="rounded-lg border border-border bg-muted/40 p-8 text-center">
                                <div className="text-base font-semibold">No results</div>
                                <div className="mt-2 text-sm text-muted-foreground">
                                    Try a different search term or filter.
                                </div>
                            </div>
                        )}

                        {!loading && !error && filteredActivities.length > 0 && (
                            <div className="grid gap-3">
                                {filteredActivities.map((a) => (
                                    <div
                                        key={a.id}
                                        className="rounded-lg border border-border bg-background p-4 shadow-sm hover:shadow-md transition"
                                    >
                                        <div className="flex items-start justify-between gap-4 flex-wrap">
                                            <div className="min-w-0">
                                                <div className="font-semibold text-base">{a.name}</div>

                                                {a.description && (
                                                    <p className="mt-2 text-sm text-muted-foreground leading-snug">
                                                        {a.description}
                                                    </p>
                                                )}

                                                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                    <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5">
                                                        Type: <span className="font-medium text-foreground">{a.activity_type}</span>
                                                    </span>
                                                    <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5">
                                                        Phases: <span className="font-medium text-foreground">{a.phases?.length ?? 0}</span>
                                                    </span>
                                                </div>
                                            </div>

                                            <Button onClick={() => openActivityModal(a)} className="shrink-0">
                                                Select
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={closeActivityModal}
                footer={
                    <>
                        <Button variant="secondary" type="button" onClick={closeActivityModal} disabled={selecting}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={confirmSelectActivity} disabled={selecting || !selectedActivity}>
                            {selecting ? "Confirming…" : "Confirm"}
                        </Button>
                    </>
                }
            >
                {!selectedActivity ? (
                    <div className="text-sm text-muted-foreground">Loading…</div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <h2 className="m-0 text-lg font-semibold">{selectedActivity.name}</h2>
                            <div className="mt-1 text-sm text-muted-foreground">
                                Type:{" "}
                                <span className="font-medium text-foreground">
                                    {selectedActivity.activity_type}
                                </span>{" "}
                                • Phases:{" "}
                                <span className="font-medium text-foreground">
                                    {selectedActivity.phases?.length ?? 0}
                                </span>
                            </div>
                        </div>

                        {selectedActivity.description && (
                            <p className="m-0 text-sm text-muted-foreground leading-snug">
                                {selectedActivity.description}
                            </p>
                        )}

                        {selectError && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {selectError}
                            </div>
                        )}

                        <div>
                            <div className="text-sm font-semibold mb-2">Phases</div>

                            <div className="overflow-x-auto rounded-lg border border-border">
                                <table className="w-full border-collapse text-sm">
                                    <thead className="bg-muted/30 text-left">
                                        <tr>
                                            <th className="px-3 py-2 border-b border-border">Name</th>
                                            <th className="px-3 py-2 border-b border-border whitespace-nowrap">Time (mins)</th>
                                            <th className="px-3 py-2 border-b border-border whitespace-nowrap">Turns</th>
                                            <th className="px-3 py-2 border-b border-border">Prompt</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(selectedActivity.phases ?? []).map((p, idx) => (
                                            <tr key={`${p.name}-${idx}`} className="align-top">
                                                <td className="px-3 py-2 border-b border-border font-medium">
                                                    {p.name}
                                                </td>
                                                <td className="px-3 py-2 border-b border-border">
                                                    {p.time_limit_minutes}
                                                </td>
                                                <td className="px-3 py-2 border-b border-border">
                                                    {p.turn_limit}
                                                </td>
                                                <td className="px-3 py-2 border-b border-border text-muted-foreground">
                                                    {p.prompt}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <p className="mt-3 text-xs text-muted-foreground">
                                Tip: Choose an activity that matches your goal and timebox.
                            </p>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}