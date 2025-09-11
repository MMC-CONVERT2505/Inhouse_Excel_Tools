const pad = (n) => String(n).padStart(2, "0");

const getFormattedTimestamp = () => {
  const now = new Date();
  return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}__${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
};

const sanitize = (str) => (str || "Unknown").replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);

const generateFileName = (file, route, timestamp, ext = ".csv") => {
  const namePart = sanitize(file?.fileName);
  const softwarePart = sanitize(file?.softwareType);
  const countryPart = sanitize(file?.countryName);
  const routePart = sanitize(route);
  return `${namePart}__${softwarePart}__${countryPart}__${routePart}__${timestamp}${ext}`;
};
