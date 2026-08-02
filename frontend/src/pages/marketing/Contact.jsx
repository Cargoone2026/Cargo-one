import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight, Building2, CheckCircle2, Headphones, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { api } from "@/lib/api";
import { Hero } from "@/components/marketing/Hero";
import { IMG } from "@/components/marketing/images";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { SEO } from "@/components/marketing/SEO";
import { useResponsive } from "@/hooks/useResponsive";

const TOPICS = [
  { id: "support", label: "Customer Support" },
  { id: "drivers", label: "Driver Support" },
  { id: "business", label: "Business & Enterprise" },
  { id: "press", label: "Press & Media" },
  { id: "other", label: "Other" },
];

export default function Contact() {
  const [params] = useSearchParams();
  const { isMobile } = useResponsive();
  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    topic: params.get("topic") || "support",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!form.name || !form.email.includes("@") || form.message.length < 10) {
      setError("Please provide your name, a valid email, and a short message (10+ characters).");
      return;
    }
    setSubmitting(true);
    try {
      await api("/contact", { method: "POST", body: form });
      setSubmitted(true);
      setForm({ name: "", email: "", phone: "", topic: form.topic, message: "" });
    } catch (err) {
      setError(err?.message || "Send failed — please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SEO
        title="Contact Us | Cargo One"
        description="Get in touch with Cargo One — customer support, driver support, business enquiries and press. 24/7 assistance for urgent safety concerns."
        path="/contact"
        image={IMG.heroContact}
      />
      <Hero
        bgImage={IMG.heroContact}
        eyebrow="CONTACT"
        title="We're here to help"
        subtitle="Have a question, need support, or want to talk business? We answer every message within 24 hours."
        compact
      />

      <Section bg="#fff">
        {submitted ? (
          <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-6" data-testid="contact-thankyou">
            <div className="flex flex-col items-center gap-2 rounded-[20px] bg-[#DCFCE7] p-8 text-center">
              <CheckCircle2 className="h-16 w-16 text-[#16A34A]" />
              <h3 className="text-[24px] font-bold text-[#111111]">Message sent</h3>
              <p className="text-[14px] text-[#111111]">
                Thanks! One of our team will reply within 24 hours.
              </p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                data-testid="contact-send-another"
                className="mt-3 inline-flex items-center gap-1 rounded-full border border-[#D62828] bg-white px-4 py-2 text-[14px] font-bold text-[#D62828]"
              >
                <Mail className="h-4 w-4" />
                Send another message
              </button>
            </div>
          </div>
        ) : (
          <div className={`flex items-start gap-12 ${isMobile ? "flex-col" : "flex-row"}`}>
            {/* Contact channels */}
            <div className="flex-1 space-y-4">
              <div>
                <p className="text-[12px] font-bold tracking-[2px] text-[#D62828]">REACH US</p>
                <h2 className="mt-1 text-[28px] font-bold text-[#111111]">Choose your channel</h2>
              </div>
              <div className="space-y-3">
                {[
                  { icon: Mail, title: "Email", body: "hello@cargoone.co.uk", tag: "Reply within 24h", href: "mailto:hello@cargoone.co.uk", testId: "contact-channel-email" },
                  { icon: Phone, title: "Office", body: "+44 800 111 000", tag: "Mon–Fri, 8am–8pm", href: "tel:+448001110000", testId: "contact-channel-phone-office" },
                  { icon: Phone, title: "Mobile / Direct line", body: "07757 133163", tag: "Click to call — 24/7", href: "tel:+447757133163", testId: "contact-channel-phone-mobile" },
                  { icon: MessageCircle, title: "WhatsApp", body: "Chat with our team on WhatsApp", tag: "07757 133163 — usually replies within minutes", href: "https://wa.me/447757133163", target: "_blank", testId: "contact-channel-whatsapp" },
                  { icon: MapPin, title: "Head office", body: "Cargo One Ltd, 1 Fleet Street, London EC4A 1AA", tag: "By appointment", href: "https://www.google.com/maps?q=1+Fleet+Street+London+EC4A+1AA", target: "_blank", testId: "contact-channel-office" },
                  { icon: Headphones, title: "Emergency line", body: "For safety incidents in progress", tag: "+44 800 111 999", href: "tel:+448001110999", testId: "contact-channel-emergency" },
                ].map((c) => {
                  const isWhatsApp = c.title === "WhatsApp";
                  return (
                    <a
                      key={c.title}
                      href={c.href}
                      target={c.target}
                      rel={c.target === "_blank" ? "noopener noreferrer" : undefined}
                      data-testid={c.testId}
                      className={`flex gap-3 rounded-[20px] border p-5 transition-colors ${
                        isWhatsApp
                          ? "border-[#25D366]/40 bg-[#F0FDF4] hover:border-[#25D366]"
                          : "border-[#E5E7EB] bg-white hover:border-[#D62828]"
                      }`}
                    >
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] ${
                          isWhatsApp ? "bg-[#25D366]" : "bg-[#FEE2E2]"
                        }`}
                      >
                        <c.icon className={`h-[22px] w-[22px] ${isWhatsApp ? "text-white" : "text-[#D62828]"}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[16px] font-bold text-[#111111]">{c.title}</p>
                        <p className="mt-0.5 break-words text-[14px] text-[#111111]">{c.body}</p>
                        <p className="mt-1 text-[12px] text-[#6B7280]">{c.tag}</p>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Form */}
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-[12px] font-bold tracking-[2px] text-[#D62828]">SEND US A MESSAGE</p>
                <h2 className="mt-1 text-[28px] font-bold text-[#111111]">We'll get back to you</h2>
              </div>
              <form onSubmit={submit} className="space-y-3 rounded-[20px] border border-[#E5E7EB] bg-white p-6">
                <div className="flex flex-wrap gap-3">
                  <div className="min-w-[220px] flex-1">
                    <label className="mb-1 block text-[12px] font-semibold text-[#111111]">Full name</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Alex Morgan"
                      data-testid="contact-name"
                      className="h-11 w-full rounded-[12px] border border-[#E5E7EB] bg-[#F4F4F4] px-3 text-[14px] text-[#111111] outline-none focus:border-[#D62828]"
                    />
                  </div>
                  <div className="min-w-[220px] flex-1">
                    <label className="mb-1 block text-[12px] font-semibold text-[#111111]">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="alex@example.com"
                      data-testid="contact-email"
                      className="h-11 w-full rounded-[12px] border border-[#E5E7EB] bg-[#F4F4F4] px-3 text-[14px] text-[#111111] outline-none focus:border-[#D62828]"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="min-w-[220px] flex-1">
                    <label className="mb-1 block text-[12px] font-semibold text-[#111111]">Phone (optional)</label>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+44 7…"
                      className="h-11 w-full rounded-[12px] border border-[#E5E7EB] bg-[#F4F4F4] px-3 text-[14px] text-[#111111] outline-none focus:border-[#D62828]"
                    />
                  </div>
                  <div className="min-w-[220px] flex-1">
                    <label className="mb-1 block text-[12px] font-semibold text-[#111111]">Topic</label>
                    <div className="flex flex-wrap gap-1">
                      {TOPICS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setForm({ ...form, topic: t.id })}
                          className={`rounded-full border px-3 py-1 text-[12px] font-medium ${
                            form.topic === t.id
                              ? "border-[#D62828] bg-[#D62828] text-white"
                              : "border-[#E5E7EB] bg-white text-[#111111]"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-[#111111]">Message</label>
                  <textarea
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Tell us how we can help …"
                    data-testid="contact-message"
                    className="w-full resize-y rounded-[12px] border border-[#E5E7EB] bg-[#F4F4F4] p-3 text-[14px] text-[#111111] outline-none focus:border-[#D62828]"
                  />
                </div>
                {error && (
                  <p data-testid="contact-error" className="text-[13px] font-medium text-[#DC2626]">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  data-testid="contact-submit"
                  className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#D62828] px-6 py-3 text-[16px] font-bold text-white disabled:opacity-60"
                >
                  {submitting ? "Sending…" : "Send Message"}
                  <ArrowRight className="h-[18px] w-[18px]" />
                </button>
                <p className="text-[12px] text-[#6B7280]">
                  By submitting you agree to our{" "}
                  <span className="font-semibold text-[#D62828]">Privacy Policy</span>. We'll never share your details with third parties.
                </p>
              </form>
            </div>
          </div>
        )}
      </Section>

      <Section bg="#F4F4F4">
        <SectionHeading eyebrow="OFFICES" title="Where we're based" />
        <div className="flex flex-wrap justify-center gap-4">
          {[
            { city: "London", body: "1 Fleet Street, London EC4A 1AA" },
            { city: "Manchester", body: "Peter House, Oxford St, Manchester M1 5AN" },
            { city: "Birmingham", body: "6 Brindley Place, Birmingham B1 2JB" },
          ].map((o) => (
            <div key={o.city} className="flex min-w-[240px] flex-1 flex-col items-center gap-2 rounded-[20px] border border-[#E5E7EB] bg-white p-6">
              <Building2 className="h-6 w-6 text-[#D62828]" />
              <p className="text-[20px] font-bold text-[#111111]">{o.city}</p>
              <p className="text-center text-[14px] text-[#6B7280]">{o.body}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
