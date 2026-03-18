"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { getAffiliateCode, clearAffiliateCode } from "./affiliate-ref-capture";

/** When user is signed in and has affiliate code in storage, record attribution. */
export function AffiliateAttribution() {
  const { data: session, status } = useSession();
  const sentRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    if (sentRef.current) return;
    const code = getAffiliateCode();
    if (!code) return;

    sentRef.current = true;
    fetch("/api/user/affiliate-attribution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ affiliateCode: code }),
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.selfReferral) clearAffiliateCode();
      })
      .catch(() => {
        sentRef.current = false;
      });
  }, [session?.user?.id, status]);

  return null;
}
