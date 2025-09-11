import React from "react";

const Loader = () => {
  return (
    <div className="fixed inset-0 bg-gradient-to-r from-[#0b1a3b] to-[#112240] flex flex-col items-center justify-center z-[9999] opacity-0">
      {/* Gradient border wrapper */}
      <div className="bg-gradient-to-r from-blue-400 via-red-500 to-pink-500 p-[3px] rounded-full mb-4">
        {/* Inner white circle to simulate border */}
        <div className="gradient-bg rounded-full w-30 h-30 overflow-hidden shadow-lg">
          <img
            src="/MMC_Convert.png"
            alt="Logo"
            className="w-30 h-30 object-cover animate-pulse"
          />
        </div>
      </div>
      
      <p className="text-white font-semibold text-2xl animate-bounce">Please wait...</p>
    </div>
  );
};

export default Loader;

