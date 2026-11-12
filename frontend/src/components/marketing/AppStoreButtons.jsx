import React from "react";

// Future Google Play listings — flip PLAY_LIVE to true once the apps are public on Google Play.
const PLAY_CUSTOMER = "https://play.google.com/store/apps/details?id=co.uk.cargoone.customer";
const PLAY_DRIVER = "https://play.google.com/store/apps/details?id=co.uk.cargoone.driver";
const PLAY_LIVE = false;

const APP_STORE = {
  customer: "https://apps.apple.com/app/cargoone-courier-delivery/id6822449616",
  driver: "https://apps.apple.com/gb/app/cargoone-driver-courier-jobs/id6822450098",
};
const PLAY_STORE = { customer: PLAY_CUSTOMER, driver: PLAY_DRIVER };

// Official store badges (local copies in /public/images/badges). `onWhite` kept for existing calls; black badges suit all backgrounds.
// eslint-disable-next-line no-unused-vars
export function AppStoreButtons({ app = "customer", onWhite = false }) {
  const key = app === "driver" ? "driver" : "customer";
  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="app-store-buttons">
      <a href={APP_STORE[key]} target="_blank" rel="noopener noreferrer" className="inline-block p-1" data-testid="app-store-badge-link">
        <img src="/images/badges/download-on-the-app-store-black.svg" alt="Download on the App Store" className="block h-[44px] w-auto" width="132" height="44" />
      </a>
      {PLAY_LIVE ? (
        <a href={PLAY_STORE[key]} target="_blank" rel="noopener noreferrer" className="inline-block p-1" data-testid="google-play-badge-link">
          {/* Google's PNG includes built-in clear space, so it's drawn taller to match the Apple badge's visual height. */}
          <img src="/images/badges/get-it-on-google-play-en.png" alt="Get it on Google Play" className="-my-[9px] block h-[64px] w-auto" width="165" height="64" />
        </a>
      ) : (
        <span className="inline-flex p-1" data-testid="android-coming-soon">
          <span className="inline-flex h-[44px] items-center rounded-[8px] bg-[#E5E7EB] px-4 text-[13px] font-semibold text-[#4B5563]" aria-label="Android app coming soon">
            Android app coming soon
          </span>
        </span>
      )}
    </div>
  );
}
