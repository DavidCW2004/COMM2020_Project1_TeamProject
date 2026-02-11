import { useEffect, useMemo, useState } from "react";
import styles from "../styles/Login.module.css";
import Modal from "../components/Modal";
import { createRoom, joinRoom, fetchRooms, type RoomListItem, fetchRoom } from "../api/client";
import modalStyles from "../styles/Modal.module.css";
import { useNavigate } from "react-router-dom";


export default function RoomsHubPage() {

    const navigate = useNavigate();
    const [rooms, setRooms] = useState<RoomListItem[]>([]);
    const [query, setQuery] = useState("");
    const [roomsError, setRoomsError] = useState<string | null>(null);
    const [roomsLoading, setRoomsLoading] = useState(true)

    const [createOpen, setCreateOpen] = useState(false);
    const [joinOpen, setJoinOpen] = useState(false);

    const [createName, setCreateName] = useState("");
    const [joinCode, setJoinCode] = useState("");

    const [createPrivate, setCreatePrivate] = useState(false);
    const [createPassword, setCreatePassword] = useState("");

    const [joinPassword, setJoinPassword] = useState("");
    const [joinNeedsPassword, setJoinNeedsPassword] = useState(false);
    const [joinChecking, setJoinChecking] = useState(false);

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
            setModalError(null);
        } catch (err) {
            setModalError(err instanceof Error ? err.message : "Failed to create room");
        } finally {
            setLoading(false);
        }
    };

    const handleJoinRoom = async () => {
        const code = joinCode.trim().toUpperCase();
        if (!code) return;

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
            setModalError(err instanceof Error ? err.message : "Failed to join room");
        } finally {
            setLoading(false);
        }
    };


    async function loadRooms() {
        setRoomsLoading(true);
        setRoomsError(null);
        try {
            const data = await fetchRooms();
            const active = data.filter((r) => r.members_count > 0 || r.is_running);
            setRooms(active);
        } catch (e) {
            setRoomsError(e instanceof Error ? e.message : "Failed to load rooms");
        } finally {
            setRoomsLoading(false);
        }
    }

    useEffect(() => {
        void loadRooms();
        const id = window.setInterval(() => void loadRooms(), 5000);
        return () => window.clearInterval(id);
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return rooms;
        return rooms.filter((r) => `${r.name} ${r.code}`.toLowerCase().includes(q));
    }, [rooms, query]);

    useEffect(() => {
        if (!joinOpen) return;

        const code = joinCode.trim().toUpperCase();
        if (code.length < 4) {
            setJoinNeedsPassword(false);
            setJoinPassword("");
            setModalError(null);
            return;
        }

        let cancelled = false;
        setJoinChecking(true);
        setModalError(null);

        const t = window.setTimeout(async () => {
            try {
                const room = await fetchRoom(code);
                if (cancelled) return;
                const isPrivate = !!(room as any).is_private;
                setJoinNeedsPassword(isPrivate);
                if (!isPrivate) setJoinPassword("");
            } catch (e) {
                if (cancelled) return;
                setJoinNeedsPassword(false);
            } finally {
                if (!cancelled) setJoinChecking(false);
            }
        }, 400);

        return () => {
            cancelled = true;
            window.clearTimeout(t);
        };
    }, [joinCode, joinOpen]);

    return (
        <div className={styles.page}>
            <div className={styles.rectangleParent}>
                <div className={styles.frameDiv}>
                    <div className={styles.rectangleDiv} />
                    <h1 className={styles.rooms}>Rooms</h1>
                </div>

                <div className={styles.buttonParent}>
                    <button className={styles.roomButton} onClick={openCreate}>
                        <div className={styles.roomLabel}>Create Room</div>
                    </button>

                    <button className={styles.roomButton} onClick={openJoin}>
                        <div className={styles.roomLabel}>Join Room</div>
                    </button>
                </div>

                <div className={styles.membersListParent} style={{ width: "100%" }}>
                    <div className={styles.membersHeading} style={{ fontSize: 28 }}>
                        Active Rooms
                    </div>


                    {roomsError && <div className={styles.error}>{roomsError}</div>}

                    {!roomsError && roomsLoading && (
                        <div style={{ textAlign: "center", opacity: 0.8, padding: 20 }}>Loading rooms…</div>
                    )}

                    {!roomsError && !roomsLoading && filtered.length === 0 && (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyTitle}>No active rooms</div>
                            <div className={styles.emptySubtitle}>Create a room or join with a code.</div>
                        </div>
                    )}

                    {!roomsError && filtered.length > 0 && (
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
                                            width: "100%",
                                            boxSizing: "border-box",
                                            overflow: "hidden",
                                        }}
                                    >
                                        <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                                            <div
                                                style={{
                                                    fontWeight: 700,
                                                    fontSize: 18,
                                                    lineHeight: 1.1,
                                                    whiteSpace: "nowrap",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                }}
                                            >
                                                {r.name}{" "}
                                                <span style={{ fontWeight: 500, fontSize: 14, opacity: 0.75 }}>
                                                    ({r.code})
                                                </span>
                                            </div>

                                            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
                                                Members: <b>{r.members_count}</b>
                                            </div>

                                            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                                                Status: <span style={{ fontWeight: 700 }}>{r.is_running ? "Running" : "Idle"}</span>
                                            </div>
                                        </div>

                                        <div style={{ flex: "0 0 auto" }}>
                                            <button
                                                className={styles.primaryButton}
                                                type="button"
                                                style={{
                                                    height: 32,
                                                    width: 140,
                                                    maxWidth: "100%",
                                                    whiteSpace: "nowrap",
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/room/${r.code}`);
                                                }}
                                            >
                                                Open Room →
                                            </button>
                                        </div>
                                    </div>

                                ))}
                            </div>
                        </div>
                    )}
                </div>

            </div>


            <Modal
                isOpen={createOpen}
                onClose={closeCreate}
                footer={
                    <button
                        onClick={handleCreateRoom}
                        disabled={loading}
                        style={{
                            width: 160,
                            height: 40,
                            borderRadius: 8,
                            background: "#bdbdbd",
                            border: "none",
                            color: "#fff",
                            cursor: "pointer",
                        }}
                    >
                        Continue
                    </button>
                }
            >
                <h2 style={{ margin: 0 }}>Create a Room</h2>

                <div className={modalStyles.form}>
                    <input
                        className={modalStyles.input}
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                        placeholder="Room Name"
                        disabled={loading}
                    />
                    {modalError && <p style={{ color: "#b00020", margin: 0 }}>{modalError}</p>}
                    <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                        <input
                            type="checkbox"
                            checked={createPrivate}
                            onChange={(e) => setCreatePrivate(e.target.checked)}
                            disabled={loading}
                        />
                        Private room (requires password)
                    </label>

                    {createPrivate && (
                        <input
                            className={modalStyles.input}
                            type="password"
                            value={createPassword}
                            onChange={(e) => setCreatePassword(e.target.value)}
                            placeholder="Set a password"
                            disabled={loading}
                            style={{ marginTop: 10 }}
                        />
                    )}
                </div>
            </Modal>


            <Modal
                isOpen={createSuccessOpen}
                onClose={() => {
                    setCreateSuccessOpen(false);
                    setCreatedRoom(null);
                    setCopied(false);
                }}
                footer={
                    <div style={{ display: "grid", gap: 10, width: "100%", justifyItems: "center" }}>
                        <button
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
                            style={{
                                width: 220,
                                height: 38,
                                borderRadius: 8,
                                background: "#e0e0e0",
                                border: "none",
                                cursor: "pointer",
                            }}
                        >
                            {copied ? "Copied!" : "Copy Code"}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                if (!createdRoom) return;
                                navigate(`/room/${createdRoom.code}`);
                            }}
                            style={{
                                width: 220,
                                height: 38,
                                borderRadius: 8,
                                background: "#bdbdbd",
                                border: "none",
                                color: "#fff",
                                cursor: "pointer",
                            }}
                        >
                            Go to Room
                        </button>
                    </div>
                }
            >
                <h2 style={{ margin: 0 }}>
                    Room Created 🎉
                </h2>

                <div className={modalStyles.form} style={{ marginTop: 12 }}>
                    <p style={{ margin: 0 }}>
                        <strong>Room Name:</strong> {createdRoom?.name ?? ""}
                    </p>
                    <p style={{ margin: 0 }}>
                        <strong>Join Code :</strong> {createdRoom?.code ?? ""}
                    </p>

                    {modalError && <p style={{ color: "#b00020", margin: 0 }}>{modalError}</p>}
                </div>
            </Modal>

            <Modal
                isOpen={joinOpen}
                onClose={closeJoin}
                footer={
                    <button
                        onClick={handleJoinRoom}
                        disabled={loading}
                        style={{
                            width: 160,
                            height: 40,
                            borderRadius: 8,
                            background: "#bdbdbd",
                            border: "none",
                            color: "#fff",
                            cursor: "pointer",
                        }}
                    >
                        Continue
                    </button>
                }
            >
                <h2 style={{ margin: 0 }}>Join a Room</h2>

                <div className={modalStyles.form}>
                    <input
                        className={modalStyles.input}
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="Room Code"
                        disabled={loading}
                    />
                    {modalError && <p style={{ color: "#b00020", margin: 0 }}>{modalError}</p>}
                    {joinChecking && (
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                            Checking room privacy…
                        </div>
                    )}

                    {joinNeedsPassword && (
                        <input
                            className={modalStyles.input}
                            type="password"
                            value={joinPassword}
                            onChange={(e) => setJoinPassword(e.target.value)}
                            placeholder="Room password"
                            disabled={loading}
                            style={{ marginTop: 10 }}
                        />
                    )}
                </div>
            </Modal>

        </div>
    );
}
