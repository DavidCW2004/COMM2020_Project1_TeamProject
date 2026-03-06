import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";

type Role = "learner" | "facilitator" | "maintainer";

type Props = {
    roles: Role[];
    children: ReactNode;
};

function getHomePathForRole(role: Role) {
    switch (role) {
        case "maintainer":
            return "/maintainer/activities";
        case "facilitator":
            return "/facilitator";
        case "learner":
        default:
            return "/rooms";
    }
}
export default function RequireRoles({ roles, children }: Props) {
    const raw = localStorage.getItem("sst:user");
    if (!raw) return <Navigate to="/" replace />;

    try {
        const user = JSON.parse(raw) as { role?: Role };
        const userRole = user?.role;

        if (!userRole || !roles.includes(userRole)) {
            return <Navigate to={userRole ? getHomePathForRole(userRole) : "/"} replace />;
        }
    } catch {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}