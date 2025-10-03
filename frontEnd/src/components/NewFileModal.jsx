import { useState, Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { toast } from "react-hot-toast";
import SoftwareTypeModal from "./SoftwareTypeModal";

// Country options by software
const countryOptions = {
  "qbo to qbo": ["Australia (AU)", "The United States of America (USA)", "South Africa (SA)"],
  "xero to xero": ["Australia"],
  "reckon desktop to xero": ["Australia"],
  "sage one to qbo": ["Australia"],
  "wave to qbo": ["Australia"],
  "wave to xero": ["Australia"],
};

export default function NewFileModal({ isOpen, setIsOpen, onAddFile }) {
  const [fileName, setFileName] = useState("");
  const [countryName, setCountryName] = useState("");
  const [softwareType, setSoftwareType] = useState("");
  const [showSoftwareModal, setShowSoftwareModal] = useState(false);
  const [currencyStatus, setCurrencyStatus] = useState("");

  const softwareKey = softwareType.toLowerCase();
  const selectedCountries = countryOptions[softwareKey] || [];
  const requiresCountry = Object.keys(countryOptions).includes(softwareKey);

  const resetFields = () => {
    setFileName("");
    setSoftwareType("");
    setCountryName("");
    setCurrencyStatus("");
    setIsOpen(false);
  };

  const handleSubmit = () => {
    if (!fileName || !softwareType || !currencyStatus || (requiresCountry && !countryName)) {
      toast.error("All fields are required");
      return;
    }

    const newFile = {
      fileName,
      softwareType,
      countryName: requiresCountry ? countryName : "",
      currencyStatus,
      status: "running",
    };

    onAddFile(newFile);
    toast.success("File added successfully!");
    resetFields();
  };

  // 🔽 Show both currencies only for QBO TO QBO and XERO TO XERO
  const currencyOptions =
    softwareKey === "qbo to qbo" || softwareKey === "xero to xero"
      ? ["Single Currency", "Multi Currency"]
      : ["Single Currency"];

  return (
    <>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={resetFields}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-60"
            leave="ease-in duration-200"
            leaveFrom="opacity-60"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gradient-to-r from-[#0b1a3b] to-[#112240] opacity-60" aria-hidden="true" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95 translate-y-2"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl gradient-bg p-6 text-white shadow-xl transition-all space-y-5 border border-gray-700">
                <Dialog.Title className="text-2xl font-bold text-white">📝 Add New File</Dialog.Title>

                <input
                  type="text"
                  placeholder="Enter file name"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-600 p-3 text-white placeholder-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <button
                  onClick={() => setShowSoftwareModal(true)}
                  className="w-full rounded-lg bg-gray-600 border border-gray-700 p-3 text-left hover:bg-gray-700 transition"
                >
                  {softwareType ? `Software: ${softwareType}` : "📦 Select Software Type"}
                </button>

                {requiresCountry && (
                  <div className="relative">
                    <select
                      value={countryName}
                      onChange={(e) => setCountryName(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-gray-700 bg-gray-800 p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">🌍 Select Country</option>
                      {selectedCountries.map((c) => (
                        <option key={c} value={c} className="bg-gray-900 text-white">
                          {c}
                        </option>
                      ))}
                    </select>
                    <span className="absolute top-3 right-3 text-white pointer-events-none">▼</span>
                  </div>
                )}

                <div className="relative">
                  <select
                    value={currencyStatus}
                    onChange={(e) => setCurrencyStatus(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-gray-700 bg-gray-800 p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">💱 Select Currency Status</option>
                    {currencyOptions.map((option) => (
                      <option key={option} value={option} className="bg-gray-900 text-white">
                        {option}
                      </option>
                    ))}
                  </select>
                  <span className="absolute top-3 right-3 text-white pointer-events-none">▼</span>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={resetFields}
                    className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition text-white font-medium"
                  >
                    Add File
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      <SoftwareTypeModal
        isOpen={showSoftwareModal}
        onSelect={(type) => {
          setSoftwareType(type.trim());
          setShowSoftwareModal(false);
          setCountryName(""); // reset country on software change
          setCurrencyStatus(""); // reset currency on software change
        }}
        onClose={() => setShowSoftwareModal(false)}
      />
    </>
  );
}
