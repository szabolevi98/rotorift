export const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem("rotorift." + key)) ?? fallback;
  } catch {
    return fallback;
  }
};
export const write = (key, value) => {
  try {
    localStorage.setItem("rotorift." + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};
