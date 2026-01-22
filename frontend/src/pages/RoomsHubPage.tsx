import styles from "../styles/Login.module.css";

export default function RoomsHubPage() {
    const rooms = []; // Placeholder for rooms data

    return (
        <div className={styles.page}>
        <div className={styles.rectangleParent}>
            <div className={styles.frameDiv}>
                <div className={styles.rectangleDiv}/>
                    <h1 className={styles.rooms}>Rooms</h1>
            </div>

            <div className={styles.buttonParent}>
                <button className={styles.roomButton}><div className={styles.roomLabel}>Create Room</div></button>
                <button className={styles.roomButton}><div className={styles.roomLabel}>Join Room</div></button>
            </div>

            <div className={styles.roomsListParent}>
                {rooms.length === 0 ? (
                    <div className = {styles.emptyState}>
                        <p className={styles.noRoomsAvailable}>No rooms available.</p>
                        <p className={styles.createOrJoinARoom}>Create a room to get started.</p>
                    </div>
                ) : (
                    rooms.map((room) => (
                        <div key={room.id}>
                            {/* Render room details here */ }
                        </div>
                    ))
                )}
            </div>

        </div>
        </div>);
}