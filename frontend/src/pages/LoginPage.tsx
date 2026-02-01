import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/Login.module.css";
import { createTempAccount } from "../api/client";


export default function LoginPage() {
    const [displayName, setDisplayName] = useState("");
    const [role, setRole] = useState<"learner" | "facilitator">("learner");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();

    const onContinue = useCallback(async () => {
        setError(null);
        setIsSubmitting(true);

        try {
            const response = await createTempAccount(displayName.trim(), role);
            const payload = {
                id: response.id,
                username: response.username,
                displayName: response.display_name,
                role: response.role,
                createdAt: new Date().toISOString(),
            };

            localStorage.setItem("sst:user", JSON.stringify(payload));
            navigate("/rooms");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create account");
        } finally {
            setIsSubmitting(false);
        }
    }, [displayName, navigate, role]);


    return (
        <div className={styles.page}>
            <div className={styles.rectangleParent}>
                <div className={styles.frameDiv}>
                    <div className={styles.rectangleDiv}/>
                        <h1 className={styles.socialStudyTeammates}>Social Study Teammates</h1>
                        <h2 className={styles.collaborativeLearningWith}>Collaborative Learning with Structured Support</h2>
                </div>
                <div className={styles.frameChild} />
                <div className={styles.rectangleGroup}>
                    <div className={styles.frameItem} />
                    <button
                        type="button"
                        className={styles.roleRowFacilitator}
                        onClick={() => setRole("facilitator")}
                    >
                        <span
                            className={`${styles.ellipse} ${role === "facilitator" ? styles.ellipseSelected : styles.ellipseUnselected
                                }`}
                        />
                        <span className={styles.roleLabel}>Facilitator</span>
                    </button>

                    <button
                        type="button"
                        className={styles.roleRowLearner}
                        onClick={() => setRole("learner")}
                    >
                        <span
                            className={`${styles.ellipse} ${role === "learner" ? styles.ellipseSelected : styles.ellipseUnselected
                                }`}
                        />
                        <span className={styles.roleLabel}>Learner</span>
                    </button>

                    <div className={styles.roleSelection}>Role Selection</div>
                    <div className={styles.displayNameBlock}>
                        <label className={styles.displayNameLabel} htmlFor="displayName">
                            Enter Display Name:
                        </label>
                        <input
                            id="displayName"
                            type="text"
                            name="name"
                            className={styles.nameInput}
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="e.g. student A"
                        />



                    </div>
                    <button
                        type="button"
                        className={styles.continueButton}
                        onClick={onContinue}
                        disabled={displayName.trim().length < 2 || isSubmitting}
                    >
                        <div className={styles.continue}>Continue</div>
                    </button>

                    {error && <p>{error}</p>}

                </div>

            </div>
        </div>);
};

