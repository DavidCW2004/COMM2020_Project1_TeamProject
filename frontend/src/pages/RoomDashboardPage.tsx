import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchRoom, fetchRoomMembers, joinRoom, startRoomActivity, type Room } from "../api/client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";

type Member = {
    id: number;
    name: string;
};

export default function RoomDashboardPage() {
    const pollRef = useRef<number | null>(null);
    const autoJoinRef = useRef(false);

    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();

    const [room, setRoom] = useState<Room | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [error, setError] = useState<string | null>(null);

    const [joinError, setJoinError] = useState<string | null>(null);
    const [joinLoading, setJoinLoading] = useState(false);
    const [joinedOnce, setJoinedOnce] = useState(false);
    const [joinPassword, setJoinPassword] = useState("");

    const isActivityRunning = room?.activity?.is_running === true;
    const isActivityFinished = room?.activity?.finished === true;

    const [copiedCode, setCopiedCode] = useState(false);
    const [noticeDismissed, setNoticeDismissed] = useState(false);

    const currentUser = useMemo(() => {
        const raw = localStorage.getItem("sst:user");
        if (!raw) return null;
        try {
            return JSON.parse(raw) as { displayName?: string; username?: string };
        } catch {
            return null;
        }
    }, []);

    const isMember = useMemo(() => {
        if (typeof room?.is_member === "boolean") return room.is_member || joinedOnce;
        if (!currentUser) return false;
        const names = [currentUser.displayName, currentUser.username].filter(Boolean);
        if (names.length === 0) return false;
        return joinedOnce || members.some((m) => names.includes(m.name));
    }, [currentUser, members, room?.is_member, joinedOnce]);

    useEffect(() => {
        if (!code) return;

        const loadRoom = async () => {
            try {
                const data = await fetchRoom(code);
                setRoom(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load room");
            }
        };

        void loadRoom();
        const id = window.setInterval(loadRoom, 2000);
        return () => window.clearInterval(id);
    }, [code]);

    useEffect(() => {
        if (!code) return;
        if (!room) return;
        if (isMember) return;
        if (room.is_private) return;
        if (autoJoinRef.current) return;

        autoJoinRef.current = true;

        const doJoin = async () => {
            try {
                setJoinError(null);
                setJoinLoading(true);

                await joinRoom(code);

                const memberData = await fetchRoomMembers(code);
                setMembers(memberData);
                setJoinedOnce(true);
            } catch (err) {
                setJoinError(err instanceof Error ? err.message : "Failed to join room");
                autoJoinRef.current = false;
            } finally {
                setJoinLoading(false);
            }
        };

        void doJoin();
    }, [code, room, isMember]);

    useEffect(() => {
        if (!code) return;
        if (!isMember) return;
        if (!isActivityRunning || isActivityFinished) return;
        navigate(`/room/${code}/activity`);
    }, [code, isActivityRunning, isActivityFinished, isMember, navigate]);

    useEffect(() => {
        if (!code) return;

        const loadMembers = async () => {
            try {
                const memberData = await fetchRoomMembers(code);
                setMembers(memberData);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load members");
            }
        };

        void loadMembers();

        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = window.setInterval(loadMembers, 2000);

        return () => {
            if (pollRef.current) window.clearInterval(pollRef.current);
            pollRef.current = null;
        };
    }, [code]);

    async function startActivity() {
        if (!code) return;

        try {
            await startRoomActivity(code);
            navigate(`/room/${code}/activity`);
        } catch (e: any) {
            setError(e.message ?? "Failed to start activity");
        }
    }

    async function handleJoinRoom() {
        if (!code) return;
        setJoinError(null);

        try {
            const needsPassword = !!room?.is_private;

            if (needsPassword && !joinPassword.trim()) {
                setJoinError("This room is private. Please enter the password.");
                return;
            }

            setJoinLoading(true);

            await joinRoom(code, needsPassword ? joinPassword : undefined);

            const memberData = await fetchRoomMembers(code);
            setMembers(memberData);
            setJoinedOnce(true);

            setJoinPassword("");
        } catch (err) {
            setJoinError(err instanceof Error ? err.message : "Failed to join room");
        } finally {
            setJoinLoading(false);
        }
    }

    async function copyRoomCode() {
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
            toast.success("Room code copied", { description: `Code: ${code}` });
        } catch {
            toast.error("Could not copy room code");
        }
    }

    const statusLabel = isActivityRunning
        ? isActivityFinished
            ? "Finished"
            : "Running"
        : room?.selected_activity
            ? "Ready"
            : "No activity";

    return (
        <div className="min-h-screen bg-gradient-to-b from-primary/10 via-muted/40 to-background text-foreground px-4 py-10">
            <div className="mx-auto w-full max-w-5xl space-y-6">
                <div className="rounded-lg border border-border bg-background/80 backdrop-blur p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                            <h1 className="text-2xl font-semibold tracking-tight truncate">
                                {room ? room.name : "Loading…"}
                            </h1>
                            <div className="mt-1 text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                                <span>
                                    Code: <span className="font-medium text-foreground">{code ?? ""}</span>
                                </span>

                                <button
                                    type="button"
                                    onClick={copyRoomCode}
                                    className="text-xs rounded-full border border-border bg-muted/40 px-2.5 py-1
               hover:bg-muted/60 transition
               focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
               focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                >
                                    {copiedCode ? "Copied!" : "Copy code"}
                                </button>

                                <span className="text-xs rounded-full border border-border bg-muted/40 px-2 py-0.5">
                                    {room?.is_private ? "Private" : "Public"}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs rounded-full border border-border bg-muted/40 px-3 py-1">
                                Activity:{" "}
                                <span className={isActivityRunning && !isActivityFinished ? "font-semibold text-primary" : "font-semibold"}>
                                    {statusLabel}
                                </span>
                            </span>

                            <Button variant="secondary" onClick={() => navigate("/rooms")}>
                                Back to rooms
                            </Button>
                        </div>
                    </div>
                </div>
                {isMember && !noticeDismissed && (
                    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground flex items-center justify-between gap-4">
                        <span>
                            Your messages are visible to other room members. Facilitators can see participation summaries only — not individual messages.
                        </span>
                        <button
                            type="button"
                            onClick={() => setNoticeDismissed(true)}
                            className="shrink-0 text-xs underline hover:text-foreground transition"
                        >
                            Got it
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3 rounded-lg border border-border bg-background p-6 shadow-sm relative overflow-visible">                        <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Members</h2>
                        <div className="text-sm text-muted-foreground">
                            {members.length} online
                        </div>
                    </div>

                        <div className={isMember ? "mt-4" : "mt-4 blur-sm opacity-60 pointer-events-none select-none"}>
                            {members.length === 0 ? (
                                <div className="text-center text-sm text-muted-foreground py-10">
                                    No members yet
                                </div>
                            ) : (
                                <div className="grid gap-2">
                                    {members.map((m) => (
                                        <div
                                            key={m.id}
                                            className="rounded-lg border border-border bg-muted/20 px-3 py-2"
                                        >
                                            {m.name}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {room && !isMember && (
                            <div className="absolute inset-0 flex items-center justify-center p-6">
                                <div className="w-full max-w-md rounded-xl border border-border bg-background/90 backdrop-blur p-5 shadow-lg">
                                    <div className="space-y-3">
                                        <div>
                                            <h3 className="text-base font-semibold">Join this room</h3>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {room.is_private
                                                    ? "This room is private — enter the password to join."
                                                    : "This room is public — click join to enter."}
                                            </p>

                                        </div>

                                        {room.is_private && (
                                            <Input
                                                type="password"
                                                value={joinPassword}
                                                onChange={(e) => setJoinPassword(e.target.value)}
                                                placeholder="Room password"
                                                disabled={joinLoading}
                                                autoComplete="off"
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" && !joinLoading) handleJoinRoom();
                                                }}
                                            />
                                        )}

                                        {joinError && (
                                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                                {joinError}
                                            </div>
                                        )}

                                        <Button
                                            onClick={handleJoinRoom}
                                            disabled={joinLoading}
                                            className="w-full"
                                        >
                                            {joinLoading ? "Joining…" : "Join room"}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-2 rounded-lg border border-border bg-background p-6 shadow-sm">
                        <h2 className="text-lg font-semibold">Activity</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Start, continue, or review the room session.
                        </p>

                        <div className="mt-5 space-y-4">
                            {isActivityRunning && !isActivityFinished && (
                                <div className="space-y-3">
                                    <div className="text-xs text-muted-foreground">Currently running</div>

                                    <div className="font-semibold">
                                        {room?.activity.activity_name}
                                    </div>

                                    <div className="text-sm text-muted-foreground">
                                        Phase:{" "}
                                        <span className="font-medium text-foreground">
                                            {room?.activity.phase_name}
                                        </span>{" "}
                                        <span className="text-muted-foreground">
                                            ({(room?.activity.phase_index ?? 0) + 1}/{room?.activity.total_phases})
                                        </span>
                                    </div>

                                    <Button onClick={() => navigate(`/room/${code}/activity`)} className="w-full">
                                        Enter activity workspace →
                                    </Button>
                                </div>
                            )}

                            {isActivityRunning && isActivityFinished && (
                                <div className="space-y-3">
                                    <div className="text-xs text-muted-foreground">Activity finished</div>
                                    <div className="font-semibold">{room?.activity.activity_name}</div>

                                    <Button variant="secondary" onClick={() => navigate(`/room/${code}/summary`)} className="w-full">
                                        View session summary
                                    </Button>
                                    <Button onClick={() => navigate(`/room/${code}/activities`)} className="w-full">
                                        Select new activity
                                    </Button>
                                </div>
                            )}

                            {!isActivityRunning && (
                                <div className="space-y-3">
                                    {!room?.selected_activity ? (
                                        <>
                                            <div className="text-xs text-muted-foreground">No activity selected</div>
                                            <Button onClick={() => navigate(`/room/${code}/activities`)} className="w-full">
                                                Select activity
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="text-xs text-muted-foreground">Selected activity</div>
                                            <div className="font-semibold">{room.selected_activity.name}</div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <Button onClick={startActivity}>Start</Button>
                                                <Button variant="secondary" onClick={() => navigate(`/room/${code}/activities`)}>
                                                    Change
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {error}
                            </div>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}