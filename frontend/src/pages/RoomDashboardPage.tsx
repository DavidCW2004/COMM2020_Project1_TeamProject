import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "../styles/Login.module.css";
import modalStyles from "../styles/Modal.module.css";

import { fetchRoom, fetchRoomMembers, joinRoom, startRoomActivity, type Room } from "../api/client";



type Member = {
    id: number;
    name: string;
};



export default function RoomDashboardPage() {

    const pollRef = useRef<number | null>(null);
    const autoJoinRef = useRef(false);

    const { code } = useParams<{ code: string }>();

    const [room, setRoom] = useState<Room | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [joinError, setJoinError] = useState<string | null>(null);
    const [joinLoading, setJoinLoading] = useState(false);
    const [joinedOnce, setJoinedOnce] = useState(false);

    const isActivityRunning = room?.activity?.is_running === true;
    const isActivityFinished = room?.activity?.finished === true;
    const [joinPassword, setJoinPassword] = useState("");


    const navigate = useNavigate();

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

        loadRoom();

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

        loadMembers();


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

                <div className={styles.membersListParent}>
                    <div className={styles.membersHeading}>Members</div>

                    <div
                        className={`${styles.membersContent} ${!isMember ? styles.blurred : ""}`}
                        aria-hidden={!isMember}
                    >
                        {members.length === 0 ? (
                            <div style={{ textAlign: "center", opacity: 0.8 }}>No members yet</div>
                        ) : (
                            <div className={styles.memberList}>
                                {members.map((m) => (
                                    <div key={m.id}>{m.name}</div>
                                ))}
                            </div>
                        )}
                    </div>

                    {room && !isMember && (
                        <div className={styles.membersOverlay}>
                            <div className={styles.membersOverlayCard}>
                                {room?.is_private && (
                                    <div style={{ width: "100%", marginBottom: 10 }}>
                                        <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>
                                            This room is private — enter the password to join.
                                        </div>

                                        <input
                                            className={modalStyles.input} 
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
                                    </div>
                                )}

                                <button
                                    className={styles.primaryButton}
                                    type="button"
                                    onClick={handleJoinRoom}
                                    disabled={joinLoading}
                                >
                                    {joinLoading ? "Joining..." : "Join Room"}
                                </button>

                                {joinError && <div className={styles.errorMessage}>{joinError}</div>}
                            </div>
                        </div>
                    )}
                </div>



                <div className={styles.activityArea}>


                    {isActivityRunning && !isActivityFinished && (
                        <>
                            <div className={styles.smallNote}>Activity</div>

                            <div style={{ marginTop: 6, fontWeight: 700, fontSize: 16 }}>
                                {room?.activity.activity_name}
                            </div>

                            <div style={{ marginTop: 6, opacity: 0.85, fontSize: 13 }}>
                                Phase: {room?.activity.phase_name} (
                                {(room?.activity.phase_index ?? 0) + 1}/
                                {room?.activity.total_phases})
                            </div>

                            <button
                                className={styles.primaryButton}
                                type="button"
                                style={{ marginTop: 12 }}
                                onClick={() => navigate(`/room/${code}/activity`)}
                            >
                                Enter Activity Workspace →
                            </button>
                        </>
                    )}


                    {isActivityRunning && isActivityFinished && (
                        <>
                            <div className={styles.smallNote}>Activity finished</div>

                            <div style={{ marginTop: 6, fontWeight: 700 }}>
                                {room?.activity.activity_name}
                            </div>

                            <button
                                className={styles.primaryButton}
                                type="button"
                                style={{ marginTop: 12 }}
                                onClick={() => navigate(`/room/${code}/summary`)}
                            >
                                View Session Summary
                            </button>

                            <button
                                className={styles.primaryButton}
                                type="button"
                                style={{ marginTop: 12 }}
                                onClick={() => navigate(`/room/${code}/activities`)}
                            >
                                Select New Activity
                            </button>
                        </>
                    )}


                    {!isActivityRunning && (
                        <>
                            {!room?.selected_activity ? (
                                <>
                                    <div className={styles.smallNote}>No activity selected</div>
                                    <button
                                        className={styles.primaryButton}
                                        type="button"
                                        onClick={() => navigate(`/room/${code}/activities`)}
                                    >
                                        Select Activity
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className={styles.smallNote}>Selected activity</div>

                                    <div style={{ marginTop: 6, fontWeight: 700, fontSize: 16 }}>
                                        {room.selected_activity.name}
                                    </div>

                                    <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                                        <button
                                            className={styles.primaryButton}
                                            type="button"
                                            onClick={startActivity}
                                        >
                                            Start Activity
                                        </button>

                                        <button
                                            className={styles.primaryButton}
                                            type="button"
                                            onClick={() => navigate(`/room/${code}/activities`)}
                                        >
                                            Change
                                        </button>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>




                {error && <div className={styles.error}>{error}</div>}
            </div>
        </div>
    );
}
