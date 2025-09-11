import React, { useState, useEffect, useRef } from 'react';
import { FaBars, FaTimes } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// ... imports remain the same

const Navbar = ({ userDetail }) => {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const detailRef = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await fetch(`/api/auth/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data && !data.error) {
            setUser(data);
          }
        } catch (err) {
          console.error('Failed to fetch user:', err);
        }
      }
    };
    fetchUser();
  }, []);

  const handleLogout = () => {
    try {
      localStorage.clear();
      toast.success('Logged out successfully!', {
        position: 'top-right',
        autoClose: 2000,
      });
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      toast.error('Logout failed. Try again.');
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (detailRef.current && !detailRef.current.contains(e.target)) {
        setShowDetails(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="bg-gradient-to-r from-[#0b1a3b] to-[#112240] text-white shadow-md sticky top-0 z-50">
      <ToastContainer />
      <div className="px-4 py-3 flex justify-between items-center">
        {/* Left */}
        <div className="text-sm md:text-base font-medium">
          <a href="/dashboard" className="hover:text-blue-400 hidden sm:inline-block">
            Dashboard
          </a>
        </div>

        {/* Center File Details */}
        <div className="hidden sm:flex flex-col items-center gap-1 text-sm text-white max-w-[60%]">
          {userDetail?.software && (
            <div className="text-base font-semibold tracking-wide text-blue-300 truncate">
              Software Type: <span className="text-white">{userDetail.software}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-3 justify-center overflow-x-auto max-w-full custom-scroll">
            {userDetail?.name && (
              <div className="flex items-center gap-1 gradient-bg px-2 py-1 rounded-md">
                <span className="text-yellow-400">📁</span>
                <span className="text-gray-200">File:</span>
                <span className="text-white font-medium truncate">{userDetail.name}</span>
              </div>
            )}
            {userDetail?.country && (
              <div className="flex items-center gap-1 gradient-bg px-2 py-1 rounded-md">
                <span className="text-green-400">🌍</span>
                <span className="text-gray-200">Country:</span>
                <span className="text-white font-medium">{userDetail.country}</span>
              </div>
            )}
            {userDetail?.currencyStatus && (
              <div className="flex items-center gap-1 gradient-bg px-2 py-1 rounded-md">
                <span className="text-purple-400">💱</span>
                <span className="text-gray-200">Currency:</span>
                <span className="text-white font-medium">{userDetail.currencyStatus}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center sm:hidden">
          <button onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
          </button>
        </div>

        <div className="hidden sm:flex items-center relative">
          <div
            className="relative"
            onMouseEnter={() => setShowDetails(true)}
            onMouseLeave={() => setShowDetails(false)}
          >
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-2 gradient-bg px-4 py-2 rounded-full shadow-md"
            >
              <img
                src={`https://ui-avatars.com/api/?name=${user?.name || 'User'}`}
                alt="avatar"
                className="w-7 h-7 rounded-full"
              />
              <span className="truncate max-w-[100px] font-semibold font-serif">{user?.name || 'User'}</span>
            </button>

            {/* Details Hover Card */}
            <AnimatePresence>
              {showDetails && (
                <motion.div
                  ref={detailRef}
                  className="absolute top-14 right-0 bg-gradient-to-r from-[#0b1a3b] to-[#112240] text-white shadow-xl rounded-xl p-4 w-72 z-50"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://ui-avatars.com/api/?name=${user?.name || 'User'}`}
                        alt="avatar"
                        className="w-10 h-10 rounded-full"
                      />
                      <div>
                        <p className="font-semibold font-serif text-lg">{user?.name}</p>
                        <p className="text-md font-serif">{user?.email}</p>
                      </div>
                    </div>
                    <button
                      className="mt-3 w-full bg-red-600 hover:bg-red-700 text-white py-1 rounded-full"
                      onClick={() => setShowLogoutConfirm(true)}
                    >
                      Logout
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            className="sm:hidden px-4 pb-4 space-y-4 text-sm"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <a href="/dashboard" className="block hover:text-blue-400">
              Dashboard
            </a>
            <div className="space-y-2">
              <div className="text-white bg-blue-600 px-3 py-1 rounded-full inline-block">
                {user?.name || 'User'}
              </div>
              <button
                className="bg-red-600 hover:bg-red-700 w-full text-white px-4 py-2 rounded"
                onClick={() => setShowLogoutConfirm(true)}
              >
                Logout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logout Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-[#0b1a3b] text-white rounded-2xl shadow-2xl p-6 w-80 text-center"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
            >
              <h3 className="text-lg font-semibold mb-3 font-serif">Confirm Logout</h3>
              <p className="text-sm mb-5 font-serif">Are you sure you want to logout?</p>
              <div className="flex justify-center gap-4">
                <button
                  className="bg-gray-300 hover:bg-gray-400 text-black px-4 py-2 rounded"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
export default Navbar;