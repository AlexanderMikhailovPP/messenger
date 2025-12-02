import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import ChatLayout from './components/ChatLayout'; // We will create this next

import { CallProvider } from './context/CallContext';

function App() {
  return (
    <Router>
      <AuthProvider>
        <CallProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <ChatLayout />
                </ProtectedRoute>
              }
            />
          </Routes>
        </CallProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
