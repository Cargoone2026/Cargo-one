// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <meta name="theme-color" content="#D62828" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Cargo One" />
        {/* Default SEO tags — individual pages override title/description via expo-router/head */}
        <title>Cargo One — Ship Anything. Anywhere. Instant Quotes.</title>
        <meta
          name="description"
          content="The UK's trusted logistics marketplace. Compare instant quotes from verified drivers for parcels, pallets, house moves, freight and vehicles. Live tracking, secure payments, photo proof of delivery."
        />
        <meta name="robots" content="index, follow" />
        <meta name="author" content="Cargo One Ltd" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Cargo One" />
        <meta property="og:locale" content="en_GB" />
        <link rel="canonical" href="https://cargoone.co.uk/" />
        {/* JSON-LD Organization schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Cargo One",
              url: "https://cargoone.co.uk",
              logo: "https://cargoone.co.uk/favicon.png",
              slogan: "Ship Anything. Anywhere. Instant Quotes.",
              sameAs: [
                "https://facebook.com/cargoone",
                "https://twitter.com/cargoone",
                "https://instagram.com/cargoone",
                "https://linkedin.com/company/cargoone",
              ],
              contactPoint: [
                {
                  "@type": "ContactPoint",
                  telephone: "+44 800 111 000",
                  contactType: "customer service",
                  areaServed: "GB",
                  availableLanguage: ["English"],
                },
              ],
            }),
          }}
        />
        {/* Google Analytics 4 - swap GA_MEASUREMENT_ID via EXPO_PUBLIC_GA_ID at build time */}
        {process.env.EXPO_PUBLIC_GA_ID ? (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.EXPO_PUBLIC_GA_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.EXPO_PUBLIC_GA_ID}', { anonymize_ip: true });
                `,
              }}
            />
          </>
        ) : null}
        {/* Google Search Console verification (populate via env) */}
        {process.env.EXPO_PUBLIC_GSC_TOKEN ? (
          <meta
            name="google-site-verification"
            content={process.env.EXPO_PUBLIC_GSC_TOKEN}
          />
        ) : null}
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body > div:first-child { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }
              /* Smooth scrolling for anchor links */
              html { scroll-behavior: smooth; }
              /* Improve font rendering */
              body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </body>
    </html>
  );
}
