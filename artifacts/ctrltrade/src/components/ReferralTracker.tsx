import { useEffect } from "react";
import { useTrackReferralClick } from "@workspace/api-client-react";

export function ReferralTracker() {
  const track = useTrackReferralClick();
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("ref");
      if (!code) return;
      const stored = sessionStorage.getItem("ctrltrade_ref_tracked");
      if (stored === code) return;
      sessionStorage.setItem("ctrltrade_ref_tracked", code);
      track.mutate({ data: { code, landingPath: window.location.pathname } });
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
