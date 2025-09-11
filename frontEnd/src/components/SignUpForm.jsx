import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { Toaster, toast } from 'react-hot-toast';


const SignUpForm = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok && data.user && data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        navigate('/admin');
        toast.success(`${data.user.name}'s Account Created successfully `);
      } else {
        toast.error(data.error || 'Registration failed')
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong")
    }
  };

  return (
    <div className="h-100 w-100 rounded-4xl flex items-center justify-center bg-gradient-to-r from-[#0b1a3b] to-[#112240] relative overflow-hidden">
      {/* Animated Background Blobs */}
      <motion.div
        className="absolute top-0 left-0 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob"
        animate={{ x: [0, 100, -100, 0], y: [0, -50, 50, 0] }}
        transition={{ duration: 22, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-0 right-0 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob"
        animate={{ x: [0, -100, 100, 0], y: [0, 50, -50, 0] }}
        transition={{ duration: 25, repeat: Infinity }}
      />

      {/* Sign Up Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 gradient-bg p-6 rounded-2xl shadow-2xl w-80"
      >
        {/* Branding */}
        <div className="flex justify-center mb-4">
          <img
            src="../../public/MMC_Convert.png" // Replace with your actual logo path
            alt="Logo"
            className="h-16 w-auto"
          />
        </div>

        <h2 className="text-xl font-semibold text-center text-white mb-4">Create New Account ✨</h2>

        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="text"
            placeholder="Full Name"
            className="w-full px-4 py-2 border text-white border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400 transition font-serif"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            type="email"
            placeholder="Email"
            className="w-full px-4 py-2 border text-white border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400 transition font-serif"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              className="w-full px-4 py-2 border text-white border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400 transition pr-10 font-serif"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <div
              onClick={() => setShowPassword(!showPassword)}
              className="absolute top-2.5 right-3 cursor-pointer text-gray-500 hover:text-purple-500"
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            type="submit"
            className="w-full py-2 bg-purple-600 text-white rounded-md font-medium hover:bg-purple-700 transition"
          >
            Create New User
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

export default SignUpForm;
