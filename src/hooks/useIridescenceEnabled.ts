import { useEffect, useState } from "react";

const addMediaListener = (mediaQuery: MediaQueryList, callback: () => void) => {
  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", callback);
    return () => mediaQuery.removeEventListener("change", callback);
  }
  mediaQuery.addListener(callback);
  return () => mediaQuery.removeListener(callback);
};

const useIridescenceEnabled = () => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      setEnabled(false);
      return;
    }

    const widthQuery = window.matchMedia("(min-width: 640px)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const update = () => {
      setEnabled(widthQuery.matches && !motionQuery.matches);
    };

    update();

    const cleanupWidth = addMediaListener(widthQuery, update);
    const cleanupMotion = addMediaListener(motionQuery, update);

    return () => {
      cleanupWidth();
      cleanupMotion();
    };
  }, []);

  return enabled;
};

export default useIridescenceEnabled;
