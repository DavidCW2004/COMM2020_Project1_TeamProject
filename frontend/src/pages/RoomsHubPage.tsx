import { useEffect, useMemo, useState } from "react";
import Modal from "../components/Modal";
import {
    createRoom,
    joinRoom,
    fetchRooms,
    type RoomListItem,
} from "../api/client";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

function RoomsSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
                <div
                    key={i}
                    className="rounded-lg border border-border bg-background p-4 shadow-sm"
                >
                    <div className="h-5 w-2/3 bg-muted rounded" />
                    <div className="mt-3 h-4 w-1/3 bg-muted rounded" />
                    <div className="mt-2 h-4 w-1/4 bg-muted rounded" />
                </div>
            ))}
        </div>
    );
}

export default function RoomsHubPage() {
    const navigate = useNavigate();

    const [rooms, setRooms] = useState<RoomListItem[]>([]);
    const [query, setQuery] = useState("");
    const [roomsError, setRoomsError] = useState<string | null>(null);
    const [roomsLoading, setRoomsLoading] = useState(true);

    const [createOpen, setCreateOpen] = useState(false);
    const [joinOpen, setJoinOpen] = useState(false);

    const [createName, setCreateName] = useState("");
    const [joinCode, setJoinCode] = useState("");

    const [createPrivate, setCreatePrivate] = useState(false);
    const [createPassword, setCreatePassword] = useState("");

    const [joinPassword, setJoinPassword] = useState("");
    const [joinNeedsPassword, setJoinNeedsPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);

    const [createSuccessOpen, setCreateSuccessOpen] = useState(false);
    const [createdRoom, setCreatedRoom] = useState<{ code: string; name: string } | null>(null);
    const [copied, setCopied] = useState(false);

    const closeCreate = () => {
        setCreateOpen(false);
        setModalError(null);
        setLoading(false);
        setCreatePrivate(false);
        setCreatePassword("");
    };

    const closeJoin = () => {
        setJoinOpen(false);
        setModalError(null);
        setLoading(false);
        setJoinPassword("");
        setJoinNeedsPassword(false);
    };

    const openCreate = () => {
        setModalError(null);
        setJoinOpen(false);
        setCreateOpen(true);
        setCreatePrivate(false);
        setCreatePassword("");
        setCreateName("");
    };

    const openJoin = () => {
        setModalError(null);
        setCreateOpen(false);
        setJoinOpen(true);
        setJoinCode("");
        setJoinPassword("");
        setJoinNeedsPassword(false);
    };

    const handleCreateRoom = async () => {
        const name = createName.trim();
        if (!name) {
            setModalError("Please enter a room name.");
            return;
        }
        if (createPrivate && createPassword.trim().length < 4) {
            setModalError("Password must be at least 4 characters.");
            return;
        }

        setLoading(true);
        setModalError(null);

        try {
            const room = await createRoom(name, createPrivate, createPrivate ? createPassword : undefined);

            setCreateOpen(false);
            setCreatedRoom({ code: room.code, name: room.name || name });
            setCreateSuccessOpen(true);

            setCreateName("");
            setCreatePrivate(false);
            setCreatePassword("");
        } catch (err) {
            setModalError(err instanceof Error ? err.message : "Failed to create room");
        } finally {
            setLoading(false);
        }
    };

    const handleJoinRoom = async () => {
        const code = joinCode.trim().toUpperCase();
        if (!code) {
            setModalError("Enter a room code.");
            return;
        }

        if (joinNeedsPassword && !joinPassword.trim()) {
            setModalError("Password is required for this room.");
            return;
        }

        setLoading(true);
        setModalError(null);

        try {
            const room = await joinRoom(code, joinNeedsPassword ? joinPassword : undefined);
            setJoinOpen(false);
            navigate(`/room/${room.code}`);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to join room";

            // If the backend indicates a password is needed, reveal the password field
            if (!joinNeedsPassword && msg.toLowerCase().includes("password")) {
                setJoinNeedsPassword(true);
                setModalError("This room is private. Enter the password to join.");
                return;
            }

            setModalError(msg);
        } finally {
            setLoading(false);
        }
    };

    async function loadRooms(options?: { silent?: boolean }) {
        const silent = options?.silent ?? false;

        if (!silent) {
            setRoomsLoading(true);
        }

        try {
            const data = await fetchRooms();
            const active = data.filter((r) => r.members_count > 0 || r.is_running || r.is_paused);

            setRooms((prev) => {
                const prevStr = JSON.stringify(prev);
                const nextStr = JSON.stringify(active);
                return prevStr === nextStr ? prev : active;
            });

            setRoomsError(null);
        } catch (e) {
            setRoomsError(e instanceof Error ? e.message : "Failed to load rooms");
        } finally {
            if (!silent) {
                setRoomsLoading(false);
            }
        }
    }

    useEffect(() => {
        void loadRooms();

        const id = window.setInterval(() => {
            void loadRooms({ silent: true });
        }, 5000);

        return () => window.clearInterval(id);
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return rooms;
        return rooms.filter((r) => `${r.name} ${r.code}`.toLowerCase().includes(q));
    }, [rooms, query]);



    return (
        <div className="min-h-screen bg-gradient-to-b from-primary/10 via-muted/40 to-background text-foreground px-4 py-10">
            <div className="mx-auto w-full max-w-5xl space-y-6">
                <div className="rounded-lg border border-border bg-background/80 backdrop-blur p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight">Rooms</h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Create a room, join with a code, or open an active room.
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={openJoin}>
                                Join room
                            </Button>
                            <Button onClick={openCreate}>Create room</Button>
                        </div>
                    </div>
                    <div className="mt-5">
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search by room name or code…"
                        />
                    </div>
                </div>
                <div className="rounded-lg border border-border bg-background p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <h2 className="text-lg font-semibold">Rooms</h2>
                        <div className="text-sm text-muted-foreground">
                            {roomsLoading ? "Loading…" : `${filtered.length} shown`}
                        </div>
                    </div>

                    <div className="mt-4">
                        {roomsError && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {roomsError}
                            </div>
                        )}

                        {!roomsError && roomsLoading && <RoomsSkeleton />}

                        {!roomsError && !roomsLoading && filtered.length === 0 && (
                            <div className="rounded-lg border border-border bg-muted/40 p-8 text-center">
                                <div className="text-base font-semibold">No active rooms</div>
                                <div className="mt-2 text-sm text-muted-foreground">
                                    Create a room or join with a code.
                                </div>
                                <div className="mt-4 flex justify-center gap-2">
                                    <Button onClick={openCreate}>Create room</Button>
                                    <Button variant="secondary" onClick={openJoin}>
                                        Join room
                                    </Button>
                                </div>
                            </div>
                        )}

                        {!roomsError && !roomsLoading && filtered.length > 0 && (
                            <div className="grid gap-3">
                                {filtered.map((r) => (
                                    <div
                                        key={r.code}
                                        className="rounded-lg border border-border bg-background p-4 shadow-sm hover:shadow-md transition"
                                    >
                                        <div className="flex items-start justify-between gap-4 flex-wrap">
                                            <div className="min-w-0">
                                                <div className="font-semibold text-base truncate">
                                                    {r.name}{" "}
                                                    <span className="font-medium text-sm text-muted-foreground">
                                                        ({r.code})
                                                    </span>
                                                </div>

                                                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                                    <span>
                                                        Members:{" "}
                                                        <span className="font-semibold text-foreground">
                                                            {r.members_count}
                                                        </span>
                                                    </span>

                                                    <span className="hidden sm:inline">•</span>

                                                    <span>
                                                        Status:{" "}
                                                        <span
                                                            className={
                                                                r.is_paused
                                                                    ? "font-semibold text-amber-700"
                                                                    : r.is_running
                                                                        ? "font-semibold text-primary"
                                                                        : "font-semibold text-foreground"
                                                            }
                                                        >
                                                            {r.is_paused ? "Paused" : r.is_running ? "Running" : "Idle"}
                                                        </span>
                                                    </span>
                                                </div>
                                            </div>

                                            <Button
                                                onClick={() => navigate(`/room/${r.code}`)}
                                                className="shrink-0"
                                            >
                                                Open room →
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
                isOpen={createOpen}
                onClose={closeCreate}
                footer={
                    <Button onClick={handleCreateRoom} disabled={loading} className="w-full sm:w-40">
                        {loading ? "Creating…" : "Continue"}
                    </Button>
                }
            >
                <div className="space-y-4">
                    <h2 className="m-0 text-lg font-semibold">Create a room</h2>

                    <div className="space-y-3">
                        <Input
                            value={createName}
                            onChange={(e) => setCreateName(e.target.value)}
                            placeholder="Room name"
                            disabled={loading}
                        />

                        {modalError && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {modalError}
                            </div>
                        )}

                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={createPrivate}
                                onChange={(e) => setCreatePrivate(e.target.checked)}
                                disabled={loading}
                            />
                            Private room (requires password)
                        </label>

                        {createPrivate && (
                            <Input
                                type="password"
                                value={createPassword}
                                onChange={(e) => setCreatePassword(e.target.value)}
                                placeholder="Set a password"
                                disabled={loading}
                            />
                        )}
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={createSuccessOpen}
                onClose={() => {
                    setCreateSuccessOpen(false);
                    setCreatedRoom(null);
                    setCopied(false);
                    setModalError(null);
                }}
                footer={
                    <div className="grid gap-2 w-full">
                        <Button
                            variant="secondary"
                            type="button"
                            onClick={async () => {
                                if (!createdRoom) return;
                                try {
                                    await navigator.clipboard.writeText(createdRoom.code);
                                    setCopied(true);
                                    window.setTimeout(() => setCopied(false), 1500);
                                } catch {
                                    setModalError("Could not copy to clipboard.");
                                }
                            }}
                        >
                            {copied ? "Copied!" : "Copy code"}
                        </Button>

                        <Button
                            type="button"
                            onClick={() => {
                                if (!createdRoom) return;
                                navigate(`/room/${createdRoom.code}`);
                            }}
                        >
                            Go to room
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <h2 className="m-0 text-lg font-semibold">Room created 🎉</h2>

                    <div className="space-y-2 text-sm">
                        <p className="m-0">
                            <span className="font-semibold">Room name:</span>{" "}
                            {createdRoom?.name ?? ""}
                        </p>
                        <p className="m-0">
                            <span className="font-semibold">Join code:</span>{" "}
                            {createdRoom?.code ?? ""}
                        </p>

                        {modalError && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {modalError}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={joinOpen}
                onClose={closeJoin}
                footer={
                    <Button onClick={handleJoinRoom} disabled={loading} className="w-full sm:w-40">
                        {loading ? "Joining…" : "Continue"}
                    </Button>
                }
            >
                <div className="space-y-4">
                    <h2 className="m-0 text-lg font-semibold">Join a room</h2>

                    <div className="space-y-3">
                        <Input
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="Room code"
                            disabled={loading}
                        />

                        {modalError && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {modalError}
                            </div>
                        )}

                        {joinNeedsPassword && (
                            <Input
                                type="password"
                                value={joinPassword}
                                onChange={(e) => setJoinPassword(e.target.value)}
                                placeholder="Room password"
                                disabled={loading}
                            />
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
}