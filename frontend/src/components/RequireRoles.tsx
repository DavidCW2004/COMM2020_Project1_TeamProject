import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";

type Props = {
    roles: Array<"learner" | "facilitator">;
    children: ReactNode;
};

export default function RequireRoles({ roles, children }: Props) {
    const raw = localStorage.getItem("sst:user");
    if (!raw) return <Navigate to="/" replace />;

    try {
        const user = JSON.parse(raw);
        const userRole = user?.role as "learner" | "facilitator" | undefined;

        if (!userRole || !roles.includes(userRole)) {
            return <Navigate to={userRole === "facilitator" ? "/facilitator" : "/rooms"} replace />;
        }
    } catch {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}
