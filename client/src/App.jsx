import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CallProvider } from './context/CallContext';
import { Toaster } from 'react-hot-toast';
import LoginPage from './pages/LoginPage';
import ChatLayout from './components/ChatLayout';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#36393f]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <AuthProvider>
      <CallProvider>
        <Router>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#2f3136',
                color: '#fff',
                border: '1px solid #40444b',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={
              <PrivateRoute>
                <ChatLayout />
              </PrivateRoute>
            } />
          </Routes>
        </Router>
      </CallProvider>
    </AuthProvider>
  );
}

export default App;
