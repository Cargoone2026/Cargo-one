import Head from "expo-router/head";
import React from "react";

type Props = {
  title: string;
  description: string;
  image?: string;
  path?: string;
};

export function SEO({ title, description, image, path }: Props) {
  // expo-router/head renders <head> tags on web and is a no-op on native.
  const url = path
    ? `https://cargoone.co.uk${path.startsWith("/") ? "" : "/"}${path}`
    : "https://cargoone.co.uk";
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="theme-color" content="#D62828" />
      <link rel="canonical" href={url} />
      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Cargo One" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      {image ? <meta property="og:image" content={image} /> : null}
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {image ? <meta name="twitter:image" content={image} /> : null}
    </Head>
  );
}
