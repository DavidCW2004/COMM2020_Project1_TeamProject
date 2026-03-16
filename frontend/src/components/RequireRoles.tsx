import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";

type Role = "learner" | "facilitator";

type Props = {
    roles: Role[];
    children: ReactNode;
};

function getHomePathForRole(role: Role) {
    return role === "facilitator" ? "/facilitator" : "/rooms";
}

export default function RequireRoles({ roles, children }: Props) {
    const raw = localStorage.getItem("sst:user");
    if (!raw) return <Navigate to="/" replace />;

    try {
        const user = JSON.parse(raw) as { role?: unknown };
        const userRole = user?.role;

        // If role is missing/invalid force re-login
        if (userRole !== "learner" && userRole !== "facilitator") {
            localStorage.removeItem("sst:user");
            return <Navigate to="/" replace />;
        }

        if (!roles.includes(userRole)) {
            return <Navigate to={getHomePathForRole(userRole)} replace />;
        }
    } catch {
        localStorage.removeItem("sst:user");
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}