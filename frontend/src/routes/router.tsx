import { createBrowserRouter } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import RoomsHubPage from "../pages/RoomsHubPage";
import RoomDashboardPage from "../pages/RoomDashboardPage";
import ActivityCatalogue from "../pages/ActivityCataloguePage";
import ActivityWorkspacePage from "../pages/ActivityWorkspacePage";



export const router = createBrowserRouter([
    { path: "/", element: <LoginPage /> },
    { path: "/rooms", element: <RoomsHubPage /> },
    { path: "/room/:code", element: <RoomDashboardPage /> },
    { path: "/room/:code/activities", element: <ActivityCatalogue /> },
    { path: "/room/:code/activity", element: <ActivityWorkspacePage /> },

]);
