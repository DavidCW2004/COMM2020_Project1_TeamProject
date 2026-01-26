import { useState } from "react";
import styles from "../styles/Login.module.css";
import Modal from "../components/Modal";
import { createRoom, joinRoom } from "../api/client";
import modalStyles from "../styles/Modal.module.css";
import { useNavigate } from "react-router-dom";

type Room = {
    id: string;
    name: string;
    code: string;
};

export default function RoomsHubPage() {

    const navigate = useNavigate();
    const rooms: Room[] = []; // Placeholder for rooms data

    const [createOpen, setCreateOpen] = useState(false);
    const [joinOpen, setJoinOpen] = useState(false);

    const [createName, setCreateName] = useState("");
    const [joinCode, setJoinCode] = useState("");

    const [loading, setLoading] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);

    const [createSuccessOpen, setCreateSuccessOpen] = useState(false);
    const [createdRoom, setCreatedRoom] = useState<{ code: string; name: string } | null>(null);
    const [copied, setCopied] = useState(false);

    const closeCreate = () => {
        setCreateOpen(false);
        setModalError(null);
        setLoading(false);
    };

    const closeJoin = () => {
        setJoinOpen(false);
        setModalError(null);
        setLoading(false);
    };

    const openCreate = () => {
        setModalError(null);
        setJoinOpen(false);
        setCreateOpen(true);
    };

    const openJoin = () => {
        setModalError(null);
        setCreateOpen(false);
        setJoinOpen(true);
    };

    const handleCreateRoom = async () => {
        const name = createName.trim();
        if (!name) {
            setModalError("Please enter a room name.");
            return;
        }

        setLoading(true);
        setModalError(null);

        try {
            const room = await createRoom(name);


            setCreateOpen(false);


            setCreatedRoom({ code: room.code, name: room.name || name });
            setCreateSuccessOpen(true);

            setCreateName("");
            setModalError(null);
        } catch (err) {
            setModalError(err instanceof Error ? err.message : "Failed to create room");
        } finally {
            setLoading(false);
        }
    };

    const handleJoinRoom = async () => {
        const code = joinCode.trim();
        if (!code) return;

        setLoading(true);
        setModalError(null);

        try {
            const room = await joinRoom(code);

            setJoinOpen(false);

            navigate(`/room/${room.code}`);

        } catch (err) {
            setModalError(err instanceof Error ? err.message : "Failed to join room");
        } finally {
            setLoading(false);
        }
    };


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

                <div className={styles.roomsListParent}>
                    {rooms.length === 0 ? (
                        <div className={styles.emptyState}>
                            <p className={styles.noRoomsAvailable}>No rooms available.</p>
                            <p className={styles.createOrJoinARoom}>Create a room to get started.</p>
                        </div>
                    ) : (
                        rooms.map((room) => (
                            <div key={room.id}>
                                {/* Render room details here */}
                                <div>{room.name}</div>
                                <div>{room.code}</div>
                            </div>
                        ))
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
                        onChange={(e) => setJoinCode(e.target.value)}
                        placeholder="Room Code"
                        disabled={loading}
                    />
                    {modalError && <p style={{ color: "#b00020", margin: 0 }}>{modalError}</p>}
                </div>
            </Modal>

        </div>
    );
}
