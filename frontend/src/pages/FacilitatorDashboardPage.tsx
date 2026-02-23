import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { FacilitatorRoomStats } from "../api/client";
import { fetchFacilitatorDashboardStats } from "../api/client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

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
        const id = window.setInterval(() => void load(), 5000);
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
        <div className="min-h-screen bg-gradient-to-b from-primary/10 via-muted/40 to-background text-foreground px-4 py-10">
            <div className="mx-auto w-full max-w-5xl space-y-6">
                <div className="rounded-lg border border-border bg-background/80 backdrop-blur p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                            <h1 className="text-2xl font-semibold tracking-tight">
                                Facilitator dashboard
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Monitor rooms, activity status and summaries
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
                                {loading ? "Loading…" : "Refresh"}
                            </Button>
                            <Button onClick={() => navigate("/facilitator/activities")}>
                                Manage activities
                            </Button>
                        </div>
                    </div>

                    <div className="mt-5">
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search rooms by name, code, activity…"
                        />
                    </div>
                </div>

                <div className="rounded-lg border border-border bg-background p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <h2 className="text-lg font-semibold">Rooms</h2>
                        <div className="text-sm text-muted-foreground">
                            {loading ? "Loading…" : `${filtered.length} shown`}
                        </div>
                    </div>

                    <div className="mt-4">
                        {error && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        {!error && loading && (
                            <div className="space-y-3">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="rounded-lg border border-border bg-background p-4">
                                        <div className="h-5 w-2/3 bg-muted rounded" />
                                        <div className="mt-3 h-4 w-5/6 bg-muted rounded" />
                                        <div className="mt-2 h-4 w-2/6 bg-muted rounded" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {!error && !loading && filtered.length === 0 && (
                            <div className="rounded-lg border border-border bg-muted/40 p-8 text-center">
                                <div className="text-base font-semibold">No rooms found</div>
                                <div className="mt-2 text-sm text-muted-foreground">
                                    Try changing your search.
                                </div>
                            </div>
                        )}

                        {!error && !loading && filtered.length > 0 && (
                            <div className="grid gap-3">
                                {filtered.map((r) => (
                                    <div
                                        key={r.code}
                                        className="rounded-lg border border-border bg-background p-4 shadow-sm hover:shadow-md transition"
                                    >
                                        <div className="flex items-start justify-between gap-4 flex-wrap">
                                            <div className="min-w-0">
                                                <div className="font-semibold text-base">
                                                    {r.name}{" "}
                                                    <span className="font-medium text-sm text-muted-foreground">
                                                        ({r.code})
                                                    </span>
                                                </div>

                                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                    <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5">
                                                        Activity:{" "}
                                                        <span className="font-medium text-foreground">
                                                            {r.current_activity || "None"}
                                                        </span>
                                                    </span>

                                                    <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5">
                                                        Participants:{" "}
                                                        <span className="font-medium text-foreground">
                                                            {r.active_participants}
                                                        </span>
                                                    </span>

                                                    <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5">
                                                        Posts:{" "}
                                                        <span className="font-medium text-foreground">
                                                            {r.post_count}
                                                        </span>
                                                    </span>

                                                    <span
                                                        className={[
                                                            "rounded-full border px-2 py-0.5",
                                                            r.is_running
                                                                ? "border-primary/40 bg-primary/10 text-primary"
                                                                : "border-border bg-muted/30 text-muted-foreground",
                                                        ].join(" ")}
                                                    >
                                                        {r.is_running ? "Running" : "Idle"}
                                                    </span>
                                                </div>
                                            </div>

                                            <Button
                                                className="shrink-0"
                                                onClick={() => navigate(`/facilitator/rooms/${r.code}/summary`)}
                                            >
                                                View summary
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                        variant="secondary"
                        className="w-full"
                        onClick={() => navigate("/facilitator/activities")}
                    >
                        Manage activities
                    </Button>

                    <Button
                        variant="secondary"
                        className="w-full"
                        onClick={() => {
                            localStorage.removeItem("sst:user");
                            navigate("/");
                        }}
                    >
                        Logout
                    </Button>
                </div>
            </div>
        </div>
    );
}