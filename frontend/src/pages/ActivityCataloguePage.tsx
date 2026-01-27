import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styles from "../styles/Login.module.css";
import { fetchRoom } from "../api/client";

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

    const filteredActivities = activities.filter((a) => {
        const q = query.trim().toLowerCase();
        const matchesQuery =
            !q ||
            a.name.toLowerCase().includes(q) ||
            (a.description ?? "").toLowerCase().includes(q);

        const matchesType = typeFilter === "all" || a.activity_type === typeFilter;

        return matchesQuery && matchesType;
    });

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
                if (!cancelled) setError(e.message ?? "Unknown error");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    function selectActivity(activity: Activity) {
        localStorage.setItem(`<room:1>code</room:1>:selectedActivityId`, String(activity.id));
        navigate(`/rooms/${code}/activity`);
    }

    return (
        <div className={styles.page}>
            <div className={styles.rectangleParent}>
                <div className={styles.frameDiv}>
                    <div className={styles.rectangleDiv} />
                    <h2 className={styles.socialStudyTeammates}>
                        {room ? room.name : "Loading..."}
                    </h2>
                    <div className={styles.collaborativeLearningWith}>Code : {code ?? ""}</div>
                </div>


                <div className={styles.activityListParent}>
                    <h1 className={styles.membersHeading}>Activity Catalogue</h1>
                    <div className={styles.catalogueControls}>
                        <input
                            className={styles.searchInput}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="search activities..."
                            aria-label="Search activities"
                        />

                        <select
                            className={styles.filterSelect}
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value as any)}
                            aria-label="Filter activities"
                        >
                            <option value="all">Filter</option>
                            <option value="problem-solving">Problem-Solving</option>
                            <option value="discussion">Discussion</option>
                            <option value="design critique">Design Critique</option>
                        </select>
                    </div>
                    {loading && <div>Loading activities…</div>}
                    {error && <div style={{ color: "crimson" }}>{error}</div>}

                    {!loading && !error && activities.length === 0 && (
                        <div className={styles.scrollArea}>No activities available.</div>
                    )}

                    {!loading && !error && filteredActivities.length > 0 && (
                        <div className={styles.activityListScroll}>
                            <div style={{ display: "grid", gap: 12 }}>
                                {filteredActivities.map((a) => (
                                    <div
                                        key={a.id}
                                        style={{
                                            border: "1px solid #ddd",
                                            borderRadius: 10,
                                            padding: 14,
                                            background: "white",
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                            <div>
                                                <div style={{ fontWeight: 700 }}>{a.name}</div>
                                                <div style={{ opacity: 0.85, marginTop: 6 }}>{a.description}</div>
                                                <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
                                                    Type: {a.activity_type} • Phases: {a.phases?.length ?? 0}
                                                </div>
                                            </div>

                                            <button onClick={() => selectActivity(a)} style={{ height: 36 }}>
                                                Select
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>

            </div>
        </div>
    );
}
