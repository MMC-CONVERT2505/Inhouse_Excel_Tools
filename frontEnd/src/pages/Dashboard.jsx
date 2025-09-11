// import { useEffect, useState, useRef } from 'react';
import React, { useEffect, useState, useRef } from 'react';
// import { FaRocket, FaFolder, FaCheck, FaEye, FaCode, FaTimes } from 'react-icons/fa';
import { FaRocket, FaFolder, FaCheck, FaEye, FaCode, FaTimes } from 'react-icons/fa';
import NewFileModal from '../components/NewFileModal';
import { Toaster } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import smoothscroll from 'smoothscroll-polyfill';
import { Player } from '@lottiefiles/react-lottie-player';
import animationData from '../assets/heroAnimation.json';

const Dashboard = () => {

  const [searchTerm, setSearchTerm] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const runningRef = useRef(null);
  const completedRef = useRef(null);
  // Polyfill for smooth scrolling in older browsers
  useEffect(() => {
    smoothscroll.polyfill();
  }, []);

  const [files, setFiles] = useState([]);
  const [form, setForm] = useState({ fileName: '', softwareType: '', countryName: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));
  useEffect(() => {
    fetchFiles();
  }, []);

  // Debounce search term to reduce API calls
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms debounce

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/files', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      setFiles(data);
    } catch (err) {
      console.error("Failed to fetch files:", err);
    }
  };

  const handleCreate = async (newFile) => {
    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newFile),
      });
      const data = await res.json();
      setFiles([...files, data]);
      setForm({ fileName: '', softwareType: '', countryName: '' });
    } catch (err) {
      console.error("File creation failed:", err);
    }
  };

  const markAsRead = async (id) => {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/files/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'completed' }),
      });
      const updated = await res.json();
      setFiles(files.map(file => (file._id === id ? updated : file)));
    } catch (err) {
      console.error("Failed to update file status:", err);
    } finally {
      setLoadingId(null);
    }
  };

  const filteredFiles = files.filter(
    (f) =>
      f.fileName.toLowerCase().includes(debouncedSearchTerm) ||
      f.softwareType.toLowerCase().includes(debouncedSearchTerm)
  );

  const runningFiles = filteredFiles.filter(f => f.status === 'running');
  const completedFiles = filteredFiles.filter(f => f.status === 'completed');

  const highlightMatch = (text, term) => {
    if (!term) return text;
    const regex = new RegExp(`(${term})`, 'gi');
    return text.split(regex).map((part, i) =>
      part.toLowerCase() === term.toLowerCase() ? (
        <mark key={i} className="bg-yellow-400 text-white rounded px-1">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const [currentSlide, setCurrentSlide] = useState(0);

  const slideImages = [
    { src: '/img1.png', caption: 'Step 1' },
    { src: '/img2.png', caption: 'Step 2' },
    { src: '/img3.png', caption: 'Step 3' },
    { src: '/img4.png', caption: 'Step 4.' },
    { src: '/img5.png', caption: 'Step 5' },
    { src: '/img6.png', caption: 'Step 6' },
    { src: '/img7.png', caption: 'Step 7' },
    { src: '/img8.png', caption: 'Step 8' },
    { src: '/img9.png', caption: 'Step 9' },
    { src: '/img10.png', caption: 'Step 10.' },
    { src: '/img11.png', caption: 'Step 11' },
    { src: '/img12.png', caption: 'Step 12' },
    { src: '/img13.png', caption: 'Step 13' },
    { src: '/img14.png', caption: 'Step 14' },
    { src: '/img15.png', caption: 'Step 15' },
    { src: '/img16.png', caption: 'Step 16' },
    { src: '/img17.png', caption: 'Step 17' },
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slideImages.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slideImages.length) % slideImages.length);
  };

  const touchStartXRef = useRef(null);

  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;
    if (diff > 50) nextSlide();
    else if (diff < -50) prevSlide();
  };

  return (
    <div className="min-h-screen flex flex-col gradient-bg text-white">
        <div className="fixed inset-0 z-0 opacity-50 pointer-events-none">
          <Player autoplay loop src={animationData} style={{ width: '100%', height: '100%' }} />
        </div>
      <Navbar user={user} />
      <div className="flex-grow px-10 py-8 overflow-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FaFolder className="text-yellow-400" />
            File Dashboard
          </h1>
        </div>

        {/* Summary Boxes */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="sticky top-0 z-40 bg-[#0f172a] py-4 px-6 rounded-b-xl shadow-md border-b border-gray-700 mb-4"
        >
          <div className="flex flex-wrap gap-4 items-center justify-between">
            {/* Running Files */}
            <div
              onClick={() => runningRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-[#0f172a] hover:bg-[#1e293b] cursor-pointer rounded-xl shadow-md flex flex-col items-center px-6 py-4 transition-all duration-200"
            >
              <span className="text-sm text-gray-400">Running Files</span>
              <span className="text-2xl font-bold text-yellow-400">{runningFiles.length}</span>
            </div>

            {/* Completed Files */}
            <div
              onClick={() => completedRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-[#0f172a] hover:bg-[#1e293b] cursor-pointer rounded-xl shadow-md flex flex-col items-center px-6 py-4 transition-all duration-200"
            >
              <span className="text-sm text-gray-400">Completed Files</span>
              <span className="text-2xl font-bold text-green-400">{completedFiles.length}</span>
            </div>

            {/* Search + Button */}
            <div className="flex flex-col md:flex-row gap-4 flex-grow justify-end items-center">
              <input
                type="text"
                placeholder="Search by Name or Software-type..."
                className="bg-gray-800 border border-gray-600 px-4 py-2 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-72"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
              />
              <button
                onClick={() => setModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium text-white transition duration-300 w-full md:w-auto"
              >
                + Create New File
              </button>
            </div>
          </div>

          {/* Modal + Toast */}
          <NewFileModal isOpen={modalOpen} setIsOpen={setModalOpen} onAddFile={handleCreate} />
          <Toaster position="top-right" />
        </motion.div>

        {/* Running Files */}
        <section
          ref={runningRef}
          className="mb-4 gradient-bg border-2 border-gray-700 p-6 rounded-b-3xl shadow-lg">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 underline">
            <FaRocket className="text-pink-400" />
            Running Files
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {runningFiles.length === 0 && (
              <p className="col-span-full text-center text-gray-400 italic">No running files found.</p>
            )}
            {runningFiles.map(file => (
              <motion.div
                key={file._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="gradient-bg p-4 rounded-b-xl shadow-lg border-l-4 border-yellow-500 "
              >
                <p className="text-lg font-semibold font-serif underline mb-1">
                  {highlightMatch(file.fileName, debouncedSearchTerm)}
                </p>
                <p className="text-sm font-mono text-gray-300">
                  {highlightMatch(file.softwareType, debouncedSearchTerm)}
                </p>
                <p className="text-sm font-mono text-gray-300">
                  {highlightMatch(file.countryName, debouncedSearchTerm)}
                </p>
                <p className="text-sm font-mono text-gray-300">
                  {highlightMatch(file.currencyStatus, debouncedSearchTerm)}
                </p>
                <p className="text-sm font-mono text-gray-300 mb-2">
                  {format(new Date(file.createdAt), 'dd MMM yyyy, hh:mm a')}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const type = file.softwareType.toLowerCase();
                      if (type === 'qbo to qbo') {
                        navigate(`/file/qbotoqbo/${file._id}`, { state: { file } });
                      } else if (type === 'sage one to qbo') {
                        navigate(`/file/sageonetoqbo/${file._id}`, { state: { file } });
                      } else if (type === 'xero to xero') {
                        navigate(`/file/xerotoxero/${file._id}`, { state: { file } });
                      } else if (type === 'reckon desktop to xero') {
                        navigate(`/file/reckondesktoptoxero/${file._id}`, { state: { file } });
                      } else {
                        alert("Unsupported software type: " + file.softwareType);
                      }
                    }}
                    className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded flex items-center gap-1"
                  >
                    <FaEye />
                    Open
                  </button>
                  <button
                    disabled={loadingId === file._id}
                    onClick={() => markAsRead(file._id)}
                    className={`px-3 py-1 rounded flex items-center gap-1 ${loadingId === file._id
                      ? 'bg-gray-500 cursor-not-allowed'
                      : 'bg-green-500 hover:bg-green-600'
                      }`}
                  >
                    {loadingId === file._id ? (
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    ) : (
                      <>
                        <FaCheck />
                        Mark as Completed
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Completed Files */}
        <section
          ref={completedRef}
          className='mb-8 gradient-bg border-2 border-gray-700 p-6 rounded-b-3xl shadow-lg'>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 underline">
            <FaCheck className="text-green-400" />
            Completed Files
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {completedFiles.length === 0 && (
              <p className="col-span-full text-center text-gray-400 italic">No completed files found.</p>
            )}
            {completedFiles.map(file => (
              <motion.div
                key={file._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-[#0f172a] p-4 rounded-b-xl shadow-lg border-l-4 border-green-500"
              >
                <p className="text-lg font-semibold font-serif line-through mb-1">
                  {highlightMatch(file.fileName, debouncedSearchTerm)}
                </p>
                <p className="text-sm font-mono text-gray-300">
                  {highlightMatch(file.softwareType, debouncedSearchTerm)}
                </p>
                <p className="text-sm font-mono text-gray-300">
                  {highlightMatch(file.countryName, debouncedSearchTerm)}
                </p>
                <p className="text-sm font-mono text-gray-300">
                  {highlightMatch(file.currencyStatus, debouncedSearchTerm)}
                </p>
                <p className="text-sm font-mono text-gray-300 mb-2">
                  {format(new Date(file.createdAt), 'dd MMM yyyy, hh:mm a')}
                </p>
                <button
                  onClick={() => {
                    const type = file.softwareType.toLowerCase();
                    if (type === 'qbo to qbo') {
                      navigate(`/file/qbotoqbo/${file._id}`, { state: { file } });
                    } else if (type === 'sage one to qbo') {
                      navigate(`/file/sageonetoqbo/${file._id}`, { state: { file } });
                    } else if (type === 'xero to xero') {
                      navigate(`/file/xerotoxero/${file._id}`, { state: { file } });
                    } else if (type === 'reckon desktop/hosted to xero') {
                      navigate(`/file/reckondesktophostedtoxero/${file._id}`, { state: { file } });
                    } else {
                      alert("Unsupported software type: " + file.softwareType);
                    }
                  }}
                  className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded flex items-center gap-1"
                >
                  <FaEye />
                  Open
                </button>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
      {/* Footer */}
      <footer className="bg-[#0f172a] border-t border-blue-800 text-gray-400 text-sm py-4 fixed bottom-0 left-0 w-full z-50">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-blue-400 font-bold tracking-wide">MMC Convert</span>
            <span className="text-gray-400">|</span>
            <FaCode className="text-blue-400" />
            <span className="italic font-serif">User Dashboard</span>
          </div>
          <div className="text-xs text-gray-500 tracking-wider">
            © {new Date().getFullYear()} MMC Convert. All rights reserved.
          </div>
        </div>

        <button
          onClick={() => setShowInfoModal(true)}
          className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg z-50"
          title="Get Started"
        >
          {/* <FaRocket className="bounce w-7 h-7 " />   */}
          <img src="/getStarted.png" alt="Get Started" className="w-8 h-8" />
        </button>

      </footer>

      {/* Information Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-0">
          <div className="bg-[#0b1a3b] text-white w-screen h-screen rounded-none border-none shadow-none overflow-y-auto relative p-6 custom-scroll">

            {/* Close Button */}
            <button
              className="absolute top-4 right-4 text-white text-2xl hover:text-red-400"
              onClick={() => setShowInfoModal(false)}
              title="Close"
            >
              <FaTimes />
            </button>

            {/* Modal Heading */}
            <h2 className="text-3xl font-bold mb-2 underline text-center font-serif">How to Run This Project</h2>

            {/* Slide Gallery */}
            <div className="relative w-full overflow-hidden rounded-lg">
              <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                {slideImages.map((item, index) => (
                  <div key={index} className="w-full flex-shrink-0 flex flex-col items-center">
                    <img
                      src={item.src}
                      alt={`Slide ${index + 1}`}
                      className="w-full max-h-[70vh] object-contain rounded shadow-lg"
                    />
                    <p className="mt-4 text-white font-medium text-center">{item.caption}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-center items-center gap-2 mt-6">
                {slideImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`w-3 h-3 rounded-full transition-all duration-300 ${currentSlide === index ? 'bg-blue-500 scale-125' : 'bg-gray-500'
                      }`}
                  />
                ))}
              </div>
              {/* Navigation buttons */}
              <button
                onClick={prevSlide}
                className="absolute top-1/2 left-2 transform -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 z-10"
              >
                ‹
              </button>
              <button
                onClick={nextSlide}
                className="absolute top-1/2 right-2 transform -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 z-10"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
