import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/Login.module.css";
import type { FacilitatorRoomStats } from "../api/client";
import { fetchFacilitatorDashboardStats } from "../api/client";

export default function FacilitatorDashboardPage() {
    const navigate = useNavigate();

    const [rooms, setRooms] = useState<FacilitatorRoomStats[]>([]);
    const [query, setQuery] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    async function load() {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchFacilitatorDashboardStats();
            setRooms(data.rooms ?? []);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load dashboard");
        } finally {
            setLoading(false);
        }
    }


    useEffect(() => {
        void load();
        const id = window.setInterval(() => void load(), 5000); // keep it feeling “live”
        return () => window.clearInterval(id);
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return rooms;
        return rooms.filter((r) => {
            const hay = `${r.name} ${r.code} ${r.current_activity ?? ""}`.toLowerCase();
            return hay.includes(q);
        });
    }, [rooms, query]);

    return (
        <div className={styles.page}>
            <div className={styles.rectangleParent}>
                <div className={styles.frameDiv}>
                    <div className={styles.rectangleDiv} />
                    <h2 className={styles.socialStudyTeammates}>Facilitator Dashboard</h2>
                    <div className={styles.collaborativeLearningWith}>
                        Monitor rooms, activity status and summaries
                    </div>
                </div>
                <div className={styles.catalogueControls} style={{ width: "100%", boxSizing: "border-box" }}>
                    <input
                        className={styles.searchInput}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search rooms by name, code, activity…"
                    />
                    <button
                        className={styles.primaryButton}
                        type="button"
                        onClick={() => void load()}
                        style={{ width: 140, height: 36 }}
                        disabled={loading}
                    >
                        {loading ? "Loading…" : "Refresh"}
                    </button>
                </div>
                <div className={styles.membersListParent} style={{ width: "100%" }}>
                    <div className={styles.membersHeading} style={{ fontSize: 28 }}>
                        Rooms
                    </div>

                    {error && <div className={styles.error}>{error}</div>}

                    {!error && loading && (
                        <div style={{ textAlign: "center", opacity: 0.8, padding: 20 }}>Loading rooms…</div>
                    )}

                    {!error && !loading && filtered.length === 0 && (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyTitle}>No rooms found</div>
                            <div className={styles.emptySubtitle}>Try changing your search.</div>
                        </div>
                    )}

                    {!error && filtered.length > 0 && (
                        <div className={styles.scrollArea} style={{ padding: 12 }}>
                            <div className={styles.memberList} style={{ marginLeft: 0 }}>
                                {filtered.map((r) => (
                                    <div
                                        key={r.code}
                                        style={{
                                            background: "#f2efef",
                                            border: "1px solid #cfcfcf",
                                            borderRadius: 10,
                                            padding: 12,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: 12,
                                        }}
                                    >
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: 18, lineHeight: 1.1 }}>
                                                {r.name}{" "}
                                                <span style={{ fontWeight: 500, fontSize: 14, opacity: 0.75 }}>
                                                    ({r.code})
                                                </span>
                                            </div>

                                            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
                                                Activity: <b>{r.current_activity || "None"}</b> · Participants:{" "}
                                                <b>{r.active_participants}</b> · Posts: <b>{r.post_count}</b>
                                            </div>

                                            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                                                Status:{" "}
                                                <span style={{ fontWeight: 700 }}>
                                                    {r.is_running ? "Running" : "Idle"}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                            <button
                                                className={styles.primaryButton}
                                                type="button"
                                                style={{ height: 32, width: 160 }}
                                                onClick={() => navigate(`/facilitator/rooms/${r.code}/summary`)}
                                            >
                                                View Summary
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className={styles.buttonParent} style={{ width: "100%" }}>
                    <button
                        className={styles.roomButton}
                        type="button"
                        onClick={() => navigate("/facilitator/activities")}
                    >
                        <span className={styles.roomLabel}>Manage Activities</span>
                    </button>

                    <button
                        className={styles.roomButton}
                        type="button"
                        onClick={() => {
                            localStorage.removeItem("sst:user");
                            navigate("/");
                        }}
                    >
                        <span className={styles.roomLabel}>Logout</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
