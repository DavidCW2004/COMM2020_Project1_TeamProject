import { createBrowserRouter } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import RoomsHubPage from "../pages/RoomsHubPage";


export const router = createBrowserRouter([
    { path: "/", element: <LoginPage /> },
    { path: "/rooms", element: <RoomsHubPage /> }
]);
