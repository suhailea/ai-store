import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/auth";
import Office from "./pages/Office";
import Approvals from "./pages/Approvals";
import Team from "./pages/Team";
import Board from "./pages/Board";
import Hire from "./pages/Hire";
import EmployeeProfile from "./pages/EmployeeProfile";
import TaskRunView from "./pages/TaskRunView";
import Connectors from "./pages/Connectors";
import Settings from "./pages/Settings";
import Chat from "./pages/Chat";
import { Workflows } from "./pages/Workflows";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected */}
        <Route path="/" element={<PrivateRoute><Navigate to="/office" replace /></PrivateRoute>} />
        <Route path="/office" element={<PrivateRoute><Office /></PrivateRoute>} />
        <Route path="/board" element={<PrivateRoute><Board /></PrivateRoute>} />
        <Route path="/approvals" element={<PrivateRoute><Approvals /></PrivateRoute>} />
        <Route path="/team" element={<PrivateRoute><Team /></PrivateRoute>} />
        <Route path="/hire" element={<PrivateRoute><Hire /></PrivateRoute>} />
        <Route path="/connectors" element={<PrivateRoute><Connectors /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="/employees/:id" element={<PrivateRoute><EmployeeProfile /></PrivateRoute>} />
        <Route path="/team/:id" element={<PrivateRoute><EmployeeProfile /></PrivateRoute>} />
        <Route path="/tasks/:id" element={<PrivateRoute><TaskRunView /></PrivateRoute>} />
        <Route path="/workflows" element={<PrivateRoute><Workflows /></PrivateRoute>} />
        <Route path="/chat" element={<PrivateRoute><Chat /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
