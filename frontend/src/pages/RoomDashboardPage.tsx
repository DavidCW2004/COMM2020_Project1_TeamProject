import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "../styles/Login.module.css";

import { fetchRoom, fetchRoomMembers } from "../api/client";

type Room = {
    code: string;
    name: string;
};

type Member = {
    id: number;
    name: string;
};

type Activity = {
    id: number;
    name: string;
    description: string;
    activity_type: string;
    phases: any[];
};


export default function RoomDashboardPage() {

    const pollRef = useRef<number | null>(null);

    const { code } = useParams<{ code: string }>();

    const [room, setRoom] = useState<Room | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [error, setError] = useState<string | null>(null);


    const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
    const [activityLoading, setActivityLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (!code) return;

        fetchRoom(code)
            .then(setRoom)
            .catch((err) => {
                setError(err instanceof Error ? err.message : "Failed to load room");
            });
    }, [code]);


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

    async function loadSelectedActivity(roomCode: string) {
        const key = `room:${roomCode}:selectedActivityId`;
        const storedId = localStorage.getItem(key);

        if (!storedId) {
            setSelectedActivity(null);
            return;
        }

        setActivityLoading(true);
        try {
            const res = await fetch(`/api/activities/${storedId}/`, { credentials: "include" });
            if (!res.ok) throw new Error(`Failed to load activity (${res.status})`);
            const data = await res.json();
            setSelectedActivity(data);
        } catch (e) {
            localStorage.removeItem(key);
            setSelectedActivity(null);
        } finally {
            setActivityLoading(false);
        }
    }

    useEffect(() => {
        if (!code) return;
        loadSelectedActivity(code);
    }, [code]);




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
                    {!selectedActivity && !activityLoading && (
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
                    )}

                    {activityLoading && (
                        <div className={styles.smallNote}>Loading activity…</div>
                    )}

                    {selectedActivity && !activityLoading && (
                        <>
                            <div className={styles.smallNote}>Selected activity</div>

                            {/* 👇 ONLY THE NAME */}
                            <div
                                style={{
                                    marginTop: 6,
                                    fontWeight: 700,
                                    fontSize: 16,
                                }}
                            >
                                {selectedActivity.name}
                            </div>

                            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                                <button
                                    className={styles.primaryButton}
                                    type="button"
                                    onClick={() => navigate(`/room/${code}/activity`)}
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
                </div>



                {error && <div className={styles.error}>{error}</div>}
            </div>
        </div>
    );
}
