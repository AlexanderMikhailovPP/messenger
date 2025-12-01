import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        const res = await login(username, password);
        if (res.success) {
            navigate('/');
        } else {
            setError(res.error);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#1a1d21]">
            <div className="bg-[#222529] p-8 rounded-lg shadow-xl w-96 border border-gray-700/50">
                <h2 className="text-2xl font-bold mb-6 text-center text-white">Login</h2>
                {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded mb-4 text-sm">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-400 mb-2 text-sm">Username</label>
                        <input
                            type="text"
                            className="w-full p-2.5 bg-[#1a1d21] border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-600"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-400 mb-2 text-sm">Password</label>
                        <input
                            type="password"
                            className="w-full p-2.5 bg-[#1a1d21] border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-600"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white py-2.5 rounded hover:bg-blue-700 transition font-medium"
                    >
                        Sign In
                    </button>
                </form>
                <p className="mt-4 text-center text-gray-500 text-sm">
                    Don't have an account? <Link to="/register" className="text-blue-400 hover:text-blue-300 hover:underline">Register</Link>
                </p>
            </div>
        </div>
    );
}
