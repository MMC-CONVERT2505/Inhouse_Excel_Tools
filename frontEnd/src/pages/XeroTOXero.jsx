// Final XeroToXero with spinner, drag-drop upload, multi-currency support, history, confirmation modal, upload progress, and animated toggles
import { useLocation, useParams } from 'react-router-dom';
import { useState } from 'react';
import { FaFolderOpen, FaChevronDown, FaChevronRight, FaTimes, FaDownload, FaTrash } from 'react-icons/fa';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { FaCode } from 'react-icons/fa';
import { useRef } from 'react';
import { useOutsideAndEscape } from "./useOutsideAndEscape";
import { Player } from '@lottiefiles/react-lottie-player';
import animationData from '../assets/heroAnimation.json';


const functionRoutesForXeroToXero = {
  Masters: {
    "Chart of Accounts": "coa",
    "Customer Master": "contact",
    "Vendor Master": "",
    "Item Master": "items",
    "Job/Tracking Class": "class",
  },
  "Open Data": {
    "AR": "ar",
    "AP": "ap",
  },
  Transaction: {
    "Invoice": "invoice",
    "Creditnote": "creditnote",
    "Manual Journal": "manualJournal",
    "Spend money": "spendmoney",
    "Receive money": "receivemoney",
    "Bill payment": "billpayment",
    "Transfer": "transfer",
    "Bill-Direct": "bill",
    "Auth Bill": "authbill",
    "Paid-Bill": "billpaid",
    "Paid-Invoice": "paidinvoice",
    "Auth Invoice": "authinvoice",
    "Invoice payment": "invoicepayment",
    "Paid credit note": "paidcreditnote",
    "Auth Credit note": "authcreditnote",
    "Auth bill credit": "authbillcredit",
    "Paid bill credit": "paidbillcredit",
    "Conversion balance": "conversionbalance",
  },
};

const multiFileInputConfig = {
  "Auth Bill": 2,
  "Paid-Bill": 2,
  "Paid-Invoice": 2,
  "Auth Invoice": 2,
  "Paid credit note": 2,
  "Auth Credit note": 2,
  "Auth bill credit": 2,
  "Paid bill credit": 2,
  "Conversion balance": 2,
};

const fileLabels = {
  // Masters
  "Chart of Accounts": ["Upload Chart of Accounts Sheet [CSV SHEET]"],
  "Customer Master": ["Upload Customer Sheet [CSV SHEET]"],
  "Vender Master": ["Upload Supplier Sheet [CSV SHEET]"],
  "Item Master": ["Upload Items Sheet [CSV SHEET]"],
  "Job/Tracking Class": ["Upload Class Sheet [CSV SHEET]"],

  // Open Data
  "AR": ["Upload Open AR Sheet [EXCEL SHEET]"],
  "AP": ["Upload Open AP Sheet [EXCEL SHEET]"],

  // Transactions
  "Invoice": ["Upload Invoice Sheet [CSV SHEET]"],
  "Creditnote": ["Upload Credit Note Sheet [CSV SHEET]"],
  "Manual Journal": ["Upload Manual Journal Sheet [EXCEL SHEET]"],
  "Spend money": ["Upload Spend Money Sheet [EXCEL SHEET]"],
  "Receive money": ["Upload Receive Money Sheet [EXCEL SHEET]"],
  "Bill payment": ["Upload Bill Payment Sheet [EXCEL SHEET]"],
  "Transfer": ["Upload Transfer Sheet [EXCEL SHEET]"],
  "Bill-Direct": ["Upload Bill-Direct Sheet [CSV SHEET]"],
  "Auth Bill": ["Upload Bill No [EXCEL SHEET]", "Upload Auth_BIll [EXCEL SHEET]"],
  "Paid-Bill": ["Upload Bill No [EXCEL SHEET]", "Upload Paid_Bill [EXCEL SHEET]"],
  "Paid-Invoice": ["Upload Invoice No [EXCEL SHEET]", "Upload Paid_Invoice [EXCEL SHEET]"],
  "Auth Invoice": ["Upload Invoice No [EXCEL SHEET]", "Upload Auth_Invoice [EXCEL SHEET]"],
  "Invoice payment": ["Upload Invoice Payment Sheet [CSV SHEET]"],
  "Paid credit note": ["Upload Invoice No [EXCEL SHEET]", "Upload Paid Credit Note [EXCEL SHEET]"],
  "Auth Credit note": ["Upload Invoice No [EXCEL SHEET]", "Upload Auth Credit Note [EXCEL SHEET]"],
  "Auth bill credit": ["Upload Bill No [EXCEL SHEET]", "Upload Auth Bill Credit [EXCEL SHEET]"],
  "Paid bill credit": ["Upload Bill No [EXCEL SHEET]", "Upload Paid Bill Credit [EXCEL SHEET]"],
  "Conversion balance": ["Upload COA Sheet [CSV SHEET]", "Upload Trial Balance [CSV SHEET]"],
};

const sectionKeyMap = {
  masters: "Masters",
  openData: "Open Data",
  transaction: "Transaction",
};

const sectionsForXeroToXero = {
  masters: Object.keys(functionRoutesForXeroToXero["Masters"]),
  openData: Object.keys(functionRoutesForXeroToXero["Open Data"]),
  transaction: Object.keys(functionRoutesForXeroToXero["Transaction"]),
};

const infoObject = {
  "Charts of Account": 'Xero [CSV SHEET]',
  "Customer": 'Xero [CSV SHEET]',
  "Vender Master": 'Xero [CSV SHEET]',
  "Items Master": 'Xero [ CSV SHEET]',
  "Job/Tracking Class": 'Xero [CSV SHEET]',
  "Open AR": 'Xero  [EXCEL SHEET]',
  "Open AP": 'Xero [EXCEL SHEET]',
  "Invoice": 'Xero/Tool [CSV SHEET]',
  "Credit Note": 'Xero /Tool[CSV SHEET]',
  "Manual Journal": 'Tool [EXCEL SHEET]',
  "Spend Money": 'Tool [EXCEL SHEET]',
  "Receive": 'Tool [EXCEL SHEET]',
  "Bill Payment": 'Tool [EXCEL SHEET]',
  "Transfer": 'Tool [EXCEL SHEET]',
  "Bill-Direct": 'Xero [CSV SHEET]',
  "Auth-Bill": 'Tool [EXCEL SHEET]',
  "Paid-Bill": 'Tool [EXCEL SHEET]',
  "Auth-Invoice": 'Tool [EXCEL SHEET]',
  "Paid-Invoice": 'Tool [EXCEL SHEET]',
  "Invoice Payment": 'Tool [CSV SHEET]',
  "Auth-CreditNote": 'Tool [EXCEL SHEET]',
  "Paid-CreditNote": 'Tool [EXCEL SHEET]',
  "Auth-BillCredit": 'Tool [EXCEL SHEET]',
  "Paid-BillCredit": 'Tool [EXCEL SHEET]',
  "Conversion Balance": 'Xero/Tool [CSV SHEET]'
};

const XeroToXero = () => {
  const { state } = useLocation();
  const { id } = useParams();
  const file = state?.file;

  const [openSection, setOpenSection] = useState('');
  const [selectedFunction, setSelectedFunction] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [convertComplete, setConvertComplete] = useState(false);
  const [downloadReady, setDownloadReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currencyCode, setCurrencyCode] = useState('');
  const [historyData, setHistoryData] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteIndex, setDeleteIndex] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const fileInputRef = useRef(null);
  const infoRef = useRef(null);
  const historyRef = useRef(null);

  useOutsideAndEscape(infoRef, () => setShowInfoModal(false));
  useOutsideAndEscape(historyRef, () => setShowHistoryModal(false));

  const softwareType = file?.softwareType?.toLowerCase().replace(/\s+/g, '');
  const rawCountry = file?.countryName?.trim();
  const countryRoute = {
    Australia: 'australia',
  }[rawCountry] || rawCountry?.toLowerCase().replace(/\s+/g, '');
  const combinedRoutePrefix = `excel-${countryRoute}-${softwareType}`;
  const currentFunctionRoutes = functionRoutesForXeroToXero;

  const getCurrencyPath = () => file?.currencyStatus?.toLowerCase() === 'multi currency' ? 'multicurrency' : 'singlecurrency';

  const handleFunctionClick = (func) => {
    handleReset();
    setSelectedFunction(func);
    setSelectedFiles([]);
    setUploadComplete(false);
    setConvertComplete(false);
    setDownloadReady(false);
    setCurrencyCode('');
  };
  const csvSheetFunctions = ["Chart of Accounts", "Customer Master", "Vendor Master", "Item Master", "Job/Tracking Class", "Conversion balance", "Invoice", "Creditnote", "Bill-Direct", "Invoice payment"];
  const excelSheetFunctions = ["AR", "AP", "Manual Journal", "Receive money", "Spend money", "Bill payment", "Transfer", "Paid-Bill", "Auth Bill", "Paid-Invoice", "Auth Invoice", "Paid credit note", "Auth Credit note", "Auth bill credit", "Paid bill credit"];

  const handleMultiFileChange = (file, index) => {
    if (!file) return;

    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const isCSV = ext === '.csv';
    const isXLSX = ext === '.xlsx' || ext === '.xls'; // ✅ Fixed here

    const shouldBeCSV = csvSheetFunctions.includes(selectedFunction);
    const shouldBeExcel = excelSheetFunctions.includes(selectedFunction);

    if (shouldBeCSV && !isCSV) {
      toast.error("This function only accepts .csv files");
      return;
    }

    if (shouldBeExcel && !isXLSX) {
      toast.error("This function only accepts .xls or .xlsx files");
      return;
    }

    if (!shouldBeCSV && !shouldBeExcel) {
      toast.error("Unsupported file type or unknown function");
      return;
    }

    const newFiles = [...selectedFiles];
    newFiles[index] = file;
    setSelectedFiles(newFiles);
    setUploadComplete(false);
    setConvertComplete(false);
    setDownloadReady(false);
  };
  const handleUpload = async () => {
    const route = currentFunctionRoutes[sectionKeyMap[openSection]]?.[selectedFunction];
    if (!route) return;

    const requiredFiles = multiFileInputConfig[selectedFunction] || 1;
    const hasAllFiles = selectedFiles.length === requiredFiles && selectedFiles.every(f => f);

    if (!hasAllFiles) {
      toast.error(`Please upload ${requiredFiles} valid Excel file(s)`);
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    const formData = new FormData();

    // ✅ Append files based on single vs multiple

    if (requiredFiles > 1) {
      selectedFiles.forEach((file, index) => {
        if (index === 0) {
          formData.append("file", file); // First file
        } else if (index === 1) {
          formData.append("file2", file); // Second file
        }
      });
    } else {
      formData.append("file", selectedFiles[0]); // Single file
    }

    formData.append("currencyCode", currencyCode);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/${combinedRoutePrefix}/${getCurrencyPath()}/upload-${route}`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      };
      xhr.onload = () => {
        if (xhr.status === 200) {
          toast.success('Uploaded successfully');
          setUploadComplete(true);
        } else {
          toast.error('Upload failed');
        }
        setLoading(false);
      };
      xhr.onerror = () => {
        toast.error('Upload failed');
        setLoading(false);
      };
      xhr.send(formData);
    } catch (err) {
      toast.error('Upload failed');
      setLoading(false);
    }
  };

  const handleConvert = async () => {
    const route = currentFunctionRoutes[sectionKeyMap[openSection]]?.[selectedFunction];
    if (!route) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/${combinedRoutePrefix}/${getCurrencyPath()}/process-${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currencyCode }),
      });
      if (!res.ok) throw new Error('Convert failed');
      toast.success('Converted successfully');
      setConvertComplete(true);
      setDownloadReady(true);
    } catch (err) {
      toast.error('Convert failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setShowDownloadConfirm(true);
  };
  const confirmDownload = async () => {
    const route = currentFunctionRoutes[sectionKeyMap[openSection]]?.[selectedFunction];
    if (!route) return;
    setLoading(true);
    try {
      // 1. Fetch the file
      const res = await fetch(`/api/${combinedRoutePrefix}/${getCurrencyPath()}/download-${route}`);
      if (!res.ok) {
        const errorMsg = await res.text();
        toast.error(errorMsg || 'Download failed');
        return;
      }

      const blob = await res.blob();

      // 2. Build a structured filename
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const isoDate = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}__${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

      const sanitize = (str) => (str || "Unknown").replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
      const namePart = sanitize(file?.fileName);
      const softwarePart = sanitize(file?.softwareType);
      const countryPart = sanitize(file?.countryName);
      const routePart = sanitize(route);

      const generatedSheetName = `${namePart}__${softwarePart}__${countryPart}__${routePart}__${isoDate}.csv`;

      link.setAttribute('download', generatedSheetName);
      document.body.appendChild(link);
      link.click();
      link.remove();

      // 3. Save the sheet under routeUsed group
      await fetch(`/api/files/${file._id}/save-sheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeUsed: route,
          sheetName: generatedSheetName
        })
      });

      setDownloadReady(false);
      toast.success('Downloaded successfully');

    } catch (err) {
      toast.error('Download failed');
    } finally {
      setShowDownloadConfirm(false);
      setLoading(false);
    }
  };
  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/files/${file._id}`);
      const data = await res.json();
      // Flatten the grouped sheets into a single array
      const flatData = (data.downloadedSheets || []).flatMap(group =>
        (group.sheets || []).map(sheet => ({
          routeUsed: group.routeUsed,
          sheetName: sheet.sheetName,
          downloadedAt: sheet.downloadedAt
        }))
      );
      // Sort by downloadedAt descending
      const sortedData = flatData.sort((a, b) => new Date(b.downloadedAt) - new Date(a.downloadedAt));
      // Update state
      setHistoryData(sortedData);
    } catch (err) {
      toast.error("Failed to fetch history");
    }
  };

  const handleHistoryDownload = async (entry) => {
    const currencyPath = getCurrencyPath();

    if (!entry?.sheetName || !file?._id || !entry?.routeUsed) {
      toast.error("Invalid download entry");
      return;
    }

    try {
      const route = entry.routeUsed;

      const response = await fetch(`/api/${combinedRoutePrefix}/${currencyPath}/download-${route}`, {
        method: 'GET',
        headers: {
          'Accept': 'text/csv'
        }
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();

      if (blob.type !== "text/csv") {
        console.warn("Unexpected MIME type:", blob.type);
        toast.error("Invalid CSV format");
        return;
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Generate valid filename with .csv extension
      const fileName = (entry.sheetName?.endsWith('.csv') ? entry.sheetName : `${entry.sheetName || 'Export'}__${route}.csv`);

      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Downloaded again successfully");
    } catch (error) {
      console.error("Error in handleHistoryDownload (CSV):", error);
      toast.error("CSV download failed");
    }
  };



  const handleHistoryDelete = async (index) => {
    try {
      const res = await fetch(`/api/files/${file._id}/delete-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index })
      });
      if (!res.ok) throw new Error("Delete failed");

      toast.success("Entry deleted");
      fetchHistory(); // refresh list
    } catch (error) {
      toast.error("Delete failed");
      console.error(error);
    }
  };

  const handleReset = () => {
    setSelectedFunction('');
    setCurrencyCode('');
    setSelectedFiles([]);
    setUploadComplete(false);
    setConvertComplete(false);
    setDownloadReady(false);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
    }
  };

  const renderSection = (name, label) => (
    <div key={name} className="transition-all duration-300">
      <button
        className="w-full sm:w-auto  flex items-center justify-between py-2 mt-4 text-left font-semibold text-white hover:text-blue-300"
        onClick={() => setOpenSection(openSection === name ? '' : name)}
      >
        <div className="flex items-center gap-2">
          <FaFolderOpen /> {label}
        </div>
        {openSection === name ? <FaChevronDown /> : <FaChevronRight />}
      </button>
      <div className={`transition-all duration-300 ease-in-out ${openSection === name ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <ul className="pl-6 text-sm font-semibold space-y-2 mt-1">
          {sectionsForXeroToXero[name].map((item) => (
            <li
              key={item}
              className={`cursor-pointer px-2 py-1 rounded transition-colors ${selectedFunction === item ? 'bg-blue-600 text-white' : 'hover:bg-[#1c2a4d] hover:text-white text-gray-300'}`}
              onClick={() => handleFunctionClick(item)}
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen gradient-bg text-white overflow-hidden">
    <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <Player autoplay loop src={animationData} style={{ width: '100%', height: '100%' }} />
      </div>
      <Toaster position="top-right" />
      <Navbar userDetail={{
        name: file?.fileName,
        software: file?.softwareType,
        country: file?.countryName,
        currencyStatus: file?.currencyStatus,
      }} />

      <div className="flex flex-col sm:flex-row flex-1 overflow-hidden custom-scroll">
        <aside className="w-full sm:w-64 gradient-bg p-2 sm:ml-3 border-r border-[#1c2a4d] flex flex-col overflow-y-auto h-auto sm:h-full custom-scroll">
          <button
            onClick={() => {
              fetchHistory();
              setShowHistoryModal(true);
            }}
            className="text-left py-2 px-3 text-white hover:text-blue-300 flex gap-2 items-center w-full sm:w-auto "
          >
            <FaFolderOpen /> History
          </button>
          {renderSection('masters', 'Masters')}
          {renderSection('openData', 'Open Data')}
          {renderSection('transaction', 'Transaction')}
        </aside>

        <main className="flex-1 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold">
              Selected Function: <span className="text-gray-300 font-semibold font-serif">{selectedFunction || ' '}</span>
            </h1>
            {(selectedFunction || selectedFile) && (
              <button className="text-red-400 hover:text-red-600 text-lg w-full sm:w-auto " onClick={handleReset} title="Clear">
                <FaTimes />
              </button>
            )}
          </div>

          {file?.currencyStatus === 'Multi Currency' && (
            <input
              type="text"
              className="mb-4 p-2 bg-[#1c2a4d] border border-gray-600 rounded w-full"
              placeholder="Enter Currency Code (e.g. USD)"
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
            />
          )}

          {selectedFunction && selectedFiles.length > 0 && (
            <div className="mt-3 mb-3 text-base text-gray-300 space-y-2">
              {selectedFiles.map((f, i) =>
                f ? (
                  <div key={i}>
                    <p><span className="font-semibold text-white">File {i + 1}:</span> {f.name}
                      <span className="font-semibold text-white ml-3">Size:</span> {(f.size / 1024).toFixed(2)} KB</p>
                  </div>
                ) : null
              )}
            </div>
          )}
          {selectedFunction && (
            <>
              {selectedFunction && fileLabels[selectedFunction]?.length > 1 ? (
                // MULTI-FILE upload
                <div className="grid gap-4">
                  {fileLabels[selectedFunction].map((label, index) => (
                    <div key={index} className="w-full">
                      <label className="block text-base font-semibold font-serif mb-1 text-gray-300">
                        {label}
                      </label>
                      <input
                        type="file"
                        accept={
                          csvSheetFunctions.includes(selectedFunction)
                            ? '.csv, .CSV'
                            : excelSheetFunctions.includes(selectedFunction)
                              ? '.xlsx, .XLSX .xls, .XLS'
                              : ''
                        }
                        ref={fileInputRef}
                        onChange={(e) => handleMultiFileChange(e.target.files[0], index)}
                        className="block w-full text-sm text-gray-100 bg-[#1c2a4d] rounded border border-gray-600 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </div>
                  ))}
                </div>
              ) : selectedFunction && (
                // SINGLE-FILE upload with label ABOVE input box
                <div className="w-full">
                  <label className="block text-base font-semibold font-serif mb-2 text-gray-300">
                    {fileLabels[selectedFunction]?.[0] || "Upload File [EXCEL SHEET]"}
                  </label>
                  <label
                    htmlFor="dropzone-file"
                    className="cursor-pointer flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-500 rounded-lg bg-[#162447] hover:bg-[#1f2e54]"
                  >
                    <p className="text-base text-gray-400">Drag & Drop or Click to Upload</p>
                    <input
                      id="dropzone-file"
                      type="file"
                      accept={
                        csvSheetFunctions.includes(selectedFunction)
                          ? '.csv, .CSV'
                          : excelSheetFunctions.includes(selectedFunction)
                            ? '.xlsx, .XLSX .xls, .XLS'
                            : ''
                      }
                      ref={fileInputRef}
                      className="hidden"
                      onChange={(e) => handleMultiFileChange(e.target.files[0], 0)}
                    />
                  </label>
                </div>
              )}
            </>
          )}
          {loading && (
            <div className="flex justify-center mt-4">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-400"></div>
            </div>
          )}
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="w-full bg-gray-600 rounded-full mt-4">
              <div className="bg-blue-500 text-xs font-medium text-blue-100 text-center p-0.5 leading-none rounded-l-full" style={{ width: `${uploadProgress}%` }}>{uploadProgress}%</div>
            </div>
          )}
          <div className="flex justify-center mt-6">
            <Toaster position="top-right" />
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
              {/* <button onClick={handleUpload} disabled={!selectedFile || uploadComplete || loading} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded disabled:opacity-50">{uploadComplete ? 'Uploaded' : loading ? 'Uploading...' : 'Upload'}</button> */}
              <button
                onClick={handleUpload}
                disabled={
                  loading ||
                  uploadComplete ||
                  !selectedFunction ||
                  (multiFileInputConfig[selectedFunction]
                    ? selectedFiles.length !== multiFileInputConfig[selectedFunction] || selectedFiles.some(f => !f)
                    : !selectedFiles[0])
                }
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded disabled:opacity-50 w-full sm:w-auto "
              >
                {uploadComplete ? 'Uploaded' : loading ? 'Uploading...' : 'Upload'}
              </button>
              <button onClick={handleConvert} disabled={!uploadComplete || convertComplete || loading} className="w-full sm:w-auto  bg-green-600 hover:bg-green-700 px-4 py-2 rounded disabled:opacity-50">{convertComplete ? 'Converted' : loading ? 'Converting...' : 'Convert'}</button>
              <button onClick={handleDownload} disabled={!downloadReady || loading} className="w-full sm:w-auto  bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded disabled:opacity-50">Download</button>
            </div>
            {/* Floating Info Button */}
            <button
              onClick={() => setShowInfoModal(true)}
              className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-blue-600 hover:bg-blue-700 text-white p-3 sm:p-4 rounded-full shadow-lg z-50 transition-all duration-200 w-14 h-14 sm:w-auto sm:h-auto flex items-center justify-center"
              title="Information"
            >
              <img
                src="/info.png"
                alt="Info"
                className="w-6 h-6 sm:w-8 sm:h-8 object-contain"
              />
            </button>
          </div>
        </main>
      </div>
      {
        showDownloadConfirm && (
          <div className="fixed inset-0 bg-[#0b1a3b]/80 z-50 flex justify-center items-center">
            <div className="bg-[#112240] p-6 rounded-xl max-w-sm w-full text-white">
              <h2 className="text-lg font-semibold mb-4">Confirm Download</h2>
              <p>Are you sure you want to download the file for <strong>{selectedFunction}</strong>?</p>
              <div className="flex justify-end gap-4 mt-6">
                <button onClick={() => setShowDownloadConfirm(false)} className="bg-gray-400 text-black px-4 py-2 rounded w-full sm:w-auto ">Cancel</button>
                <button onClick={confirmDownload} className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded w-full sm:w-auto ">Yes, Download</button>
              </div>
            </div>
          </div>
        )
      }
      {
        showHistoryModal && (
          <div className="fixed inset-0 bg-gradient-to-r from-[#0b1a3b] to-[#112240] bg-opacity-60 z-50 flex items-center justify-center">
            <div
              ref={historyRef}
              className="gradient-bg rounded-2xl p-6 w-[95%] max-w-3xl shadow-2xl relative border border-blue-400">
              <button
                className="absolute top-3 right-4 text-white text-xl hover:text-red-400 w-full sm:w-auto "
                onClick={() => setShowHistoryModal(false)}
              >
                <FaTimes />
              </button>
              <h2 className="text-2xl font-bold mb-6 text-white border-b border-blue-300 pb-2 font-serif">
                {file?.fileName || 'File'} History
              </h2>
              <div className="max-h-[400px] overflow-y-auto pr-2 custom-scroll">
                {historyData.length > 0 ? (
                  historyData.map((entry, index) => (
                    <div
                      key={index}
                      className="bg-gradient-to-r from-[#0b1a3b] to-[#112240] text-white rounded-lg px-4 py-3 mb-4 flex justify-between items-center shadow-md"
                    >
                      <div>
                        <div className="font-semibold text-lg font-serif">Function: {entry.routeUsed}</div>
                        <div className="text-sm text-white">Sheet: {entry.sheetName}</div>
                        <div className="text-sm text-white">
                          Processed on {new Date(entry.downloadedAt).toISOString().split('T')[0]}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full w-full sm:w-auto "
                          title="Download"
                          onClick={() => handleHistoryDownload(entry)}
                        >
                          <FaDownload />
                        </button>
                        <button
                          className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full w-full sm:w-auto "
                          title="Delete"
                          onClick={() => {
                            setDeleteIndex(index);
                            setShowDeleteConfirm(true);
                          }}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-white">No download history available.</p>
                )}
              </div>
            </div>
          </div>
        )
      }
      {
        showDeleteConfirm && (
          <div className="fixed inset-0 bg-gradient-to-r from-[#0b1a3b] to-[#112240] bg-opacity-60 z-50 flex items-center justify-center">
            <div className="gradient-bg text-white rounded-xl p-6 w-full max-w-sm shadow-2xl border border-gray-300">
              <h3 className="text-xl font-semibold mb-4">Confirm Deletion</h3>
              <p className="mb-6 text-sm text-white">Are you sure you want to delete this entry?</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-[#0b1a4b] px-4 py-2 rounded w-full sm:w-auto "
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleHistoryDelete(deleteIndex);
                    setShowDeleteConfirm(false);
                    setDeleteIndex(null);
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded w-full sm:w-auto "
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        showInfoModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 font-serif">
            {/* Modal box */}
            <div
              ref={infoRef}
              className="bg-[#0b1a3b] text-white rounded border border-gray-500 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative p-6 custom-scroll">

              {/* Close Button */}
              <button
                className="absolute top-4 right-4 text-white text-2xl hover:text-red-400 w-full sm:w-auto "
                onClick={() => setShowInfoModal(false)}
                title="Close"
              >
                <FaTimes />
              </button>

              {/* Modal Content */}
              <div className="text-center mt-4">
                <h2 className="text-3xl font-bold mb-6 underline font-serif">Information</h2>
                <p className="text-lg leading-7 text-gray-200 mb-6">
                  Welcome to the <span className='font-semibold underline text-xl'>XERO to XERO</span> converter panel.
                  Select a function from the sidebar, upload the required files, and follow the steps to convert and download.
                  <br /><br />
                  Multi-currency files may require specifying a currency code.
                  <br /><br />
                  You can also view previously downloaded files in the History section.
                </p>

                <div className="text-white">
                  <h2 className="text-3xl font-bold mb-6 text-center underline font-serif">Information Table</h2>

                  <div className="border border-gray-500 rounded-lg overflow-hidden">
                    <table className="w-full table-auto border-collapse text-sm">
                      <thead className="bg-blue-700">
                        <tr>
                          <th className="p-3 border font-serif text-lg border-gray-600">Function</th>
                          <th className="p-3 border font-serif text-lg border-gray-600">Sheet By Xero/TOOL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(infoObject).map(([key, value], index) => (
                          <tr key={index} className="odd:bg-[#112240] even:bg-[#1c2a4d]">
                            <td className="p-2 border border-gray-600">{key}</td>
                            <td className="p-2 border border-gray-600">{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }
      <footer className="bg-gradient-to-r from-[#0b1a3b] to-[#112240] text-gray-300 text-sm py-4 border-t border-blue-700">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-blue-400 font-bold tracking-wide">MMC Convert</span>
            <span className="text-gray-400">|</span>
            <FaCode className="text-blue-400" />
            <span className="italic font-serif">{file?.softwareType}</span>
            <span className="italic">{file?.countryName}</span>
          </div>
          <div className="text-xs text-gray-500 tracking-wider">
            © {new Date().getFullYear()} MMC Convert. All rights reserved.
          </div>
        </div>
      </footer>
    </div >
  );
};
export default XeroToXero;
