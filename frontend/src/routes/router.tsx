import { createBrowserRouter } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import RoomsHubPage from "../pages/RoomsHubPage";
import RoomDashboardPage from "../pages/RoomDashboardPage";


export const router = createBrowserRouter([
    { path: "/", element: <LoginPage /> },
    { path: "/rooms", element: <RoomsHubPage /> },
    { path: "/room/:code", element: <RoomDashboardPage /> } 
]);
