import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import toast from 'react-hot-toast';


const LoginForm = ({ setToken, onAdminLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    // If onAdminLogin prop exists, call it and check if it's handled
    if (onAdminLogin) {
      const isAdmin = await onAdminLogin(email, password);
      if (isAdmin) return; // If it's admin, handled by parent
      // else continue normal login flow
    }

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (data.token) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
      navigate('/dashboard');
    } else {
      toast.error(data.error);
    }
  };


  return (
    <div className="h-100 w-100 rounded-4xl flex items-center justify-center bg-gradient-to-r from-[#0b1a3b] to-[#112240] relative overflow-hidden">
      {/* Animated Blobs */}
      <motion.div
        className="absolute top-0 left-0 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob"
        animate={{ x: [0, 100, -100, 0], y: [0, -50, 50, 0] }}
        transition={{ duration: 20, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-0 right-0 w-80 h-80 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob"
        animate={{ x: [0, -100, 100, 0], y: [0, 50, -50, 0] }}
        transition={{ duration: 25, repeat: Infinity }}
      />

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 gradient-bg p-6 rounded-2xl shadow-2xl w-80"
      >
        {/* Branding */}
        <div className="flex justify-center mb-4">
          <img
            src="../../public/MMC_Convert.png" // change this to your actual logo path
            alt="Logo"
            className="h-16 w-auto"
          />
        </div>

        <h2 className="text-xl font-semibold text-center text-white mb-6">Welcome Back 👋</h2>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border text-white border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 transition font-serif"
            required
          />

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border text-white border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 transition pr-10 font-serif"
              required
            />
            <div
              onClick={() => setShowPassword(!showPassword)}
              className="absolute top-2.5 right-3 cursor-pointer text-gray-500 hover:text-indigo-500"
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            type="submit"
            className="w-full py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 transition"
          >
            Login
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};
export default LoginForm;
