import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import ScriptPage from "./pages/ScriptPage";
import LoginPage from "./pages/LoginPage";
import HomeRedirect from "./pages/HomeRedirect";
import AuthGuard from "./components/AuthGuard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/dashboard"
          element={
            <AuthGuard>
              <DashboardPage />
            </AuthGuard>
          }
        />

        <Route
          path="/script/:id"
          element={
            <AuthGuard>
              <ScriptPage />
            </AuthGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}