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

export default function RoomDashboardPage() {

    const pollRef = useRef<number | null>(null);

    const { code } = useParams<{ code: string }>();

    const [room, setRoom] = useState<Room | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [error, setError] = useState<string | null>(null);

    // later: activity state
    const [hasActivity] = useState(false);
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

                {/* Empty Activity State */}
                <div className={styles.activityArea}>
                    {!hasActivity && (
                        <>
                            <div className={styles.smallNote}>No activity running</div>
                            <button className={styles.primaryButton} type="button" onClick={() => navigate(`/room/${code}/activities`)}>
                                Select Activity
                            </button>
                        </>
                    )}
                </div>

                {error && <div className={styles.error}>{error}</div>}
            </div>
        </div>
    );
}
