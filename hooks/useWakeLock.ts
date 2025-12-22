import { useEffect, useRef, useState } from "react";

export const useWakeLock = () => {
  const [isLocked, setIsLocked] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = async () => {
    if ("wakeLock" in navigator) {
      try {
        const wakeLock = await navigator.wakeLock.request("screen");
        wakeLockRef.current = wakeLock;
        setIsLocked(true);
        console.log("✅ Screen Wake Lock active");

        wakeLock.addEventListener("release", () => {
          console.log("🛑 Screen Wake Lock released");
          setIsLocked(false);
        });
      } catch (err: any) {
        console.error(`❌ Wake Lock request failed: ${err.name}, ${err.message}`);
      }
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  useEffect(() => {
    // 탭 왓다갔다 할 때 풀리는 것 방지 (다시 돌아오면 재요청)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseWakeLock();
    };
  }, []);

  return { requestWakeLock, releaseWakeLock, isLocked };
};
