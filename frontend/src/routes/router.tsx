import { createBrowserRouter } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import RoomsHubPage from "../pages/RoomsHubPage";
import RoomDashboardPage from "../pages/RoomDashboardPage";
import ActivityCatalogue from "../pages/ActivityCataloguePage";
import ActivityWorkspacePage from "../pages/ActivityWorkspacePage";
import SessionSummaryPage from "../pages/SessionSummaryPage";
import FacilitatorDashboardPage from "../pages/FacilitatorDashboardPage";
import RequireRole from "../components/RequireRole";
import FacilitatorRoomSummaryPage from "../pages/FacilitatorRoomSummaryPage";


export const router = createBrowserRouter([
    { path: "/", element: <LoginPage /> },

    {
        path: "/rooms",
        element: (
            <RequireRole role="learner">
                <RoomsHubPage />
            </RequireRole>
        ),
    },
    {
        path: "/room/:code",
        element: (
            <RequireRole role="learner">
                <RoomDashboardPage />
            </RequireRole>
        ),
    },
    {
        path: "/room/:code/activities",
        element: (
            <RequireRole role="learner">
                <ActivityCatalogue />
            </RequireRole>
        ),
    },
    {
        path: "/room/:code/activity",
        element: (
            <RequireRole role="learner">
                <ActivityWorkspacePage />
            </RequireRole>
        ),
    },
    {
        path: "/room/:code/summary",
        element: (
            <RequireRole role="learner">
                <SessionSummaryPage />
            </RequireRole>
        ),
    },

    {
        path: "/facilitator",
        element: (
            <RequireRole role="facilitator">
                <FacilitatorDashboardPage />
            </RequireRole>
        ),
    },
    {
        path : "/facilitator/rooms/:code/summary",
        element: (
            <RequireRole role="facilitator">
                <FacilitatorRoomSummaryPage />
            </RequireRole>
        ),
    },
]);
