import LoginPage from "../pages/LoginPage";
import RoomsHubPage from "../pages/RoomsHubPage";
import RoomDashboardPage from "../pages/RoomDashboardPage";
import ActivityCatalogue from "../pages/ActivityCataloguePage";
import ActivityWorkspacePage from "../pages/ActivityWorkspacePage";
import SessionSummaryPage from "../pages/SessionSummaryPage";
import FacilitatorDashboardPage from "../pages/FacilitatorDashboardPage";
import FacilitatorRoomSummaryPage from "../pages/FacilitatorRoomSummaryPage";
import RequireRoles from "../components/RequireRoles";
import FacilitatorActivitiesPage from "../pages/FacilitatorActivitiesPage";
import {createBrowserRouter } from "react-router-dom";

export const router = createBrowserRouter([
    { path: "/", element: <LoginPage /> },

    {
        path: "/rooms",
        element: (
            <RequireRoles roles={["learner"]}>
                <RoomsHubPage />
            </RequireRoles>
        ),
    },
    {
        path: "/room/:code",
        element: (
            <RequireRoles roles={["learner"]}>
                <RoomDashboardPage />
            </RequireRoles>
        ),
    },
    {
        path: "/room/:code/activities",
        element: (
            <RequireRoles roles={["learner"]}>
                <ActivityCatalogue />
            </RequireRoles>
        ),
    },
    {
        path: "/room/:code/activity",
        element: (
            <RequireRoles roles={["learner"]}>
                <ActivityWorkspacePage />
            </RequireRoles>
        ),
    },
    {
        path: "/room/:code/summary",
        element: (
            <RequireRoles roles={["learner"]}>
                <SessionSummaryPage />
            </RequireRoles>
        ),
    },

    {
        path: "/facilitator",
        element: (
            <RequireRoles roles={["facilitator"]}>
                <FacilitatorDashboardPage />
            </RequireRoles>
        ),
    },
    {
        path: "/facilitator/rooms/:code/summary",
        element: (
            <RequireRoles roles={["facilitator"]}>
                <FacilitatorRoomSummaryPage />
            </RequireRoles>
        ),
    },
    {
        path: "/facilitator/activities",
        element: (
            <RequireRoles roles={["facilitator"]}>
                <FacilitatorActivitiesPage />
            </RequireRoles>
        ),
    },
    
]);