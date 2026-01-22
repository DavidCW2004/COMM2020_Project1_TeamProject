import { useCallback, useState } from "react";
import type { FunctionComponent } from "react";
import styles from "../styles/Login.module.css";

type Role = "facilitator" | "learner";

const LoginPage: FunctionComponent = () => {
    const [displayName, setDisplayName] = useState("");
    const [role, setRole] = useState<"learner" | "facilitator">("learner");

    const onContinue = useCallback(() => {
        const payload = {
            displayName: displayName.trim(),
            role,
            createdAt: new Date().toISOString(),
        };

        //Placeholder "submit"
        localStorage.setItem("sst:user", JSON.stringify(payload));
        console.log("Saved user:", payload);

    }, [displayName, role]);


    return (
        <div className={styles.login}>
            <div className={styles.rectangleParent}>
                <div className={styles.frameDiv}>
                    <div className={styles.rectangleDiv} />
                    <div className={styles.socialStudyTeammates}>{`Social Study Teammates `}</div>
                    <div className={styles.collaborativeLearningWith}>Collaborative Learning with Structured Support</div>
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
                        disabled={displayName.trim().length < 2}
                    >
                        <div className={styles.continue}>Continue</div>
                    </button>

                </div>

            </div>
        </div>);
};

export default LoginPage;
