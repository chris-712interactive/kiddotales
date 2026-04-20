"use client";

import Script from "next/script";

const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();

/**
 * Loads Meta Pixel base script + PageView when NEXT_PUBLIC_META_PIXEL_ID is set.
 * Subscription purchase also fires client-side from Settings (deduped with CAPI via eventID).
 */
export function MetaPixel() {
  if (!pixelId) return null;

  return (
    <>
      <Script id="meta-pixel-init" strategy="afterInteractive">
        {`
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
        `.trim()}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          className="hidden"
          src={`https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
