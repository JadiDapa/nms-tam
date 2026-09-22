"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-renders the server page with fresh data every few seconds while the tab is visible. Live views (devices,
// incidents) use it so a device that goes DOWN shows up without the user pressing reload.
export default function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);

  return null;
}
