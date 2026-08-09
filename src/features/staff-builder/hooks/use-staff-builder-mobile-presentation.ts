import { useEffect, useState } from "react";

export const STAFF_BUILDER_MOBILE_VKB_QUERY = "(max-width: 700px), (pointer: coarse) and (max-width: 900px)";

function currentMatch(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(STAFF_BUILDER_MOBILE_VKB_QUERY).matches;
}

export function useStaffBuilderMobilePresentation(): boolean {
  const [mobile, setMobile] = useState(currentMatch);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(STAFF_BUILDER_MOBILE_VKB_QUERY);
    const update = () => setMobile(query.matches);
    update();
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", update);
      return () => query.removeEventListener("change", update);
    }
    query.addListener?.(update);
    return () => query.removeListener?.(update);
  }, []);
  return mobile;
}
