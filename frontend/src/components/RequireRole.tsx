import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";

type Props = {
    role: "learner" | "facilitator";
    children: ReactNode;
};

export default function RequireRole({ role, children }: Props) {
    const raw = localStorage.getItem("sst:user");
    if (!raw) return <Navigate to="/" replace />;

    try {
        const user = JSON.parse(raw);
        if (user.role !== role) {
            return (
                <Navigate
                    to={user.role === "facilitator" ? "/facilitator" : "/rooms"}
                    replace
                />
            );
        }
    } catch {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}
