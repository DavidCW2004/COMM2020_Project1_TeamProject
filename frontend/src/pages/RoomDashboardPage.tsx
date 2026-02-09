import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "../styles/Login.module.css";

import { fetchRoom, fetchRoomMembers, joinRoom, startRoomActivity } from "../api/client";

type Room = {
    code: string;
    name: string;
    selected_activity: { id: number; name: string } | null;
    activity: {
        is_running: boolean;
        finished: boolean;
        activity_id: number | null;
        activity_name: string | null;
        phase_index?: number | null;
        phase_name?: string | null;
        phase_prompt?: string | null;
        phase_ends_at?: string | null;
        total_phases?: number | null;
    };
};


type Member = {
    id: number;
    name: string;
};



export default function RoomDashboardPage() {

    const pollRef = useRef<number | null>(null);

    const { code } = useParams<{ code: string }>();

    const [room, setRoom] = useState<Room | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [joinError, setJoinError] = useState<string | null>(null);
    const [joinLoading, setJoinLoading] = useState(false);

    const isActivityRunning = room?.activity?.is_running === true;
    const isActivityFinished = room?.activity?.finished === true;


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
        if (!currentUser) return false;
        const names = [currentUser.displayName, currentUser.username].filter(Boolean);
        if (names.length === 0) return false;
        return members.some((m) => names.includes(m.name));
    }, [currentUser, members]);

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
        setJoinLoading(true);
        setJoinError(null);
        try {
            await joinRoom(code);
            const memberData = await fetchRoomMembers(code);
            setMembers(memberData);
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

                    {/* Members Card */}
                    <div className={styles.membersListParent}>
                        <div className={styles.membersHeading}>Members</div>

                        {!isMember && (
                            <div style={{ marginBottom: 12, textAlign: "center" }}>
                                <button
                                    className={styles.primaryButton}
                                    type="button"
                                    onClick={handleJoinRoom}
                                    disabled={joinLoading}
                                >
                                    {joinLoading ? "Joining..." : "Join Room"}
                                </button>
                                {joinError && (
                                    <div style={{ marginTop: 6, color: "crimson", fontSize: 12 }}>{joinError}</div>
                                )}
                            </div>
                        )}

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
