import React from "react";
import { Section } from "@/components/marketing/Section";
import { SEO } from "@/components/marketing/SEO";
import { LEGAL_CONTENT } from "@/pages/Settings";

// Public legal pages (/terms, /privacy, /cookies) — same content as /settings/:slug.
export default function Legal({ slug }) {
  const doc = LEGAL_CONTENT[slug];
  return (
    <>
      <SEO title={doc.title} description={`Cargo One ${doc.title}.`} path={`/${slug}`} />
      <Section narrow testId={`legal-page-${slug}`}>
        <h1 className="text-4xl font-bold tracking-tight text-[#111111] sm:text-5xl" data-testid="legal-title">
          {doc.title}
        </h1>
        <p
          className="mt-8 whitespace-pre-wrap text-[15px] leading-relaxed text-[#111111]"
          data-testid="legal-body"
        >
          {doc.body}
        </p>
      </Section>
    </>
  );
}
