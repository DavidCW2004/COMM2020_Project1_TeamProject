import { useEffect, useRef, useState } from "react";
import styles from "../styles/Login.module.css";
import { createRoom, fetchMessages, joinRoom, postMessage, type Message } from "../api/client";

export default function RoomsHubPage() {
    const rooms = []; // Placeholder for rooms data
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageText, setMessageText] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [activeRoom, setActiveRoom] = useState<string | null>(null);
    const [activeRoomName, setActiveRoomName] = useState<string | null>(null);
    const pollRef = useRef<number | null>(null);

    useEffect(() => {
        if (!activeRoom) {
            setMessages([]);
            setActiveRoomName(null);
            return;
        }

        const load = () => {
            fetchMessages(activeRoom)
                .then(setMessages)
                .catch((err) => setError(err instanceof Error ? err.message : "Failed to load messages"));
        };

        load();
        pollRef.current = window.setInterval(load, 2000);

        return () => {
            if (pollRef.current) {
                window.clearInterval(pollRef.current);
            }
        };
    }, [activeRoom]);

    const onSend = async () => {
        const content = messageText.trim();
        if (!content) {
            return;
        }

        if (!activeRoom) {
            setError("Join or create a room first");
            return;
        }

        try {
            const created = await postMessage(activeRoom, content);
            setMessages((prev) => [...prev, created]);
            setMessageText("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to send message");
        }
    };

    const onCreateRoom = async () => {
        const name = window.prompt("Enter a room name (for your reference):");
        if (!name) {
            return;
        }

        try {
            const room = await createRoom(name.trim());
            setActiveRoom(room.code);
            setActiveRoomName(room.name || name.trim());
            window.alert(`Room created. Share this code to join: ${room.code}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create room");
        }
    };

    const onJoinRoom = async () => {
        const code = window.prompt("Enter a room code to join:");
        if (!code) {
            return;
        }

        try {
            const room = await joinRoom(code.trim());
            setActiveRoom(room.code);
            setActiveRoomName(room.name || null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to join room");
        }
    };

    return (
        <div className={styles.page}>
        <div className={styles.rectangleParent}>
            <div className={styles.frameDiv}>
                <div className={styles.rectangleDiv}/>
                    <h1 className={styles.rooms}>Rooms</h1>
            </div>

            <div className={styles.buttonParent}>
                <button className={styles.roomButton} onClick={onCreateRoom}>
                    <div className={styles.roomLabel}>Create Room</div>
                </button>
                <button className={styles.roomButton} onClick={onJoinRoom}>
                    <div className={styles.roomLabel}>Join Room</div>
                </button>
            </div>

            <div style={{ width: "100%" }}>
                <h2 style={{ margin: "16px 0 8px" }}>
                    Room Chat{activeRoom ? ` — ${activeRoom}${activeRoomName ? ` (${activeRoomName})` : ""}` : ""}
                </h2>
                <div style={{
                    border: "1px solid #cfcfcf",
                    borderRadius: 8,
                    padding: 12,
                    minHeight: 160,
                    maxHeight: 220,
                    overflowY: "auto",
                    background: "#fff"
                }}>
                    {messages.length === 0 ? (
                        <p style={{ opacity: 0.7 }}>No messages yet.</p>
                    ) : (
                        messages.map((message) => (
                            <div key={message.id} style={{ marginBottom: 8 }}>
                                <strong>{message.author_name}:</strong> {message.content}
                            </div>
                        ))
                    )}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <input
                        type="text"
                        value={messageText}
                        onChange={(event) => setMessageText(event.target.value)}
                        placeholder="Type a message"
                        style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #cfcfcf" }}
                    />
                    <button type="button" onClick={onSend} style={{ padding: "8px 12px" }}>
                        Send
                    </button>
                </div>
                {error && <p style={{ color: "#b00020" }}>{error}</p>}
            </div>

        </div>
        </div>);
}