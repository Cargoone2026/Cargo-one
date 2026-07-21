import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ChevronLeft,
  FileText,
  Lock,
  Cookie,
  Mail,
  Star,
  Info,
  Code,
  Trash2,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui-portal/Button";

/**
 * Settings hub — restores parity with the original Expo
 * `app/settings/[slug].tsx`. Was accidentally omitted during the initial
 * web migration; restored in Phase 2D. Delete-account uses the
 * pre-existing `POST /api/auth/me/delete` backend contract.
 */
const CONTENT = {
  terms: {
    title: "Terms & Conditions",
    body: `Welcome to Cargo One. By using our platform you agree to the following terms.

1. THE SERVICE
Cargo One is a marketplace that connects customers with independent transport providers ("drivers"). Cargo One is not a party to the transport contract between customer and driver.

2. BOOKING FEE
Cargo One charges a Booking Fee (calculated from the driver's charge, tiered by configurable bands) which is collected via Stripe at the time of booking confirmation. The remainder is paid by the customer directly to the driver on delivery.

3. ELIGIBILITY
Drivers must submit valid documents (licence, insurance, vehicle registration, ID, proof of address, profile photo) and be approved by Cargo One's admin team.

4. USER CONDUCT
Users agree not to abuse the platform, contact drivers/customers outside the app before deposit is paid, or falsify information.

5. PAYMENTS
Booking Fees are non-refundable once a driver has been assigned unless the driver cancels or fails to arrive. Disputes are handled case-by-case by Cargo One.

6. LIABILITY
Cargo One provides the platform "as is" and does not guarantee availability or specific delivery outcomes. Drivers are independent contractors responsible for their own insurance and legal compliance.

7. TERMINATION
Cargo One may suspend or delete accounts for breach of these terms.

8. CONTACT
Questions? support@cargoone.com`,
  },
  privacy: {
    title: "Privacy Policy",
    body: `Cargo One respects your privacy. This policy explains what we collect and how we use it.

WHAT WE COLLECT
- Account details (name, email, phone)
- Documents (driving licence, insurance, ID) for driver verification
- Location data (with your permission) for live tracking
- Booking history, messages, ratings and reviews
- Photos you upload (POD, reviews)

HOW WE USE IT
- To match customers and drivers
- To process Booking Fees via Stripe
- To provide live tracking and communication
- To enforce our Terms and prevent fraud

SHARING
- With Stripe (payments), Google (maps), and law-enforcement where legally required.
- Never sold to advertisers.

YOUR RIGHTS
- Access, correct, or delete your data at any time from Settings > Delete Account.
- Contact support@cargoone.com for GDPR / UK-DPA requests.

RETENTION
- Booking records are retained for 7 years for accounting/tax compliance.
- Personal data is deleted within 30 days of account deletion, subject to legal holds.`,
  },
  cookies: {
    title: "Cookie Policy",
    body: `Cargo One uses only strictly-necessary cookies (session authentication) on our web application. We do NOT use advertising or third-party analytics cookies without your consent.`,
  },
  about: {
    title: "About Cargo One",
    body: `Cargo One — Ship Anything. Anywhere. Instant Quotes.

Cargo One is a premium logistics marketplace connecting customers with verified transport providers across the UK. We handle furniture, pallets, cars, motorcycles, house moves, parcels, freight, documents, boats and machinery.

Our model:
- Free to post a job
- Drivers bid or accept a fixed price
- Cargo One collects a transparent Booking Fee
- The rest is paid directly to your driver on delivery`,
  },
};

export default function Settings() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function performDelete() {
    setDeleting(true);
    try {
      await api("/auth/me/delete", { method: "POST" });
      await logout();
      navigate("/auth/welcome", { replace: true });
    } catch (e) {
      setDeleting(false);
      // eslint-disable-next-line no-alert
      alert(e?.message || "Account could not be deleted");
    }
  }

  // ---- Slug-specific views ----
  if (slug === "delete-account") {
    return (
      <ShellPage title="Delete account" onBack={() => navigate(-1)} testID="settings-delete-account">
        <div className="flex items-start gap-3 rounded-[12px] border border-[#FCA5A5] bg-[#FEF2F2] p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-[#DC2626]" />
          <p className="text-[13px] leading-relaxed text-[#7F1D1D]">
            Deleting your account cannot be undone. Bookings remain visible
            to your counterparty for their records.
          </p>
        </div>
        <p className="mt-3 text-[14px] leading-relaxed text-[#111111]">
          When you delete your account, we permanently remove your profile,
          chat history, uploaded documents and ratings. Booking records are
          anonymised and kept for 7 years for tax compliance.
        </p>
        {!confirmDelete ? (
          <Button
            title="Delete my account"
            variant="outline"
            onClick={() => setConfirmDelete(true)}
            testID="delete-account-start"
            className="mt-6"
          />
        ) : (
          <div
            className="mt-6 space-y-2 rounded-[12px] border border-[#DC2626] p-3"
            data-testid="delete-account-confirm-box"
          >
            <p className="text-[13px] font-semibold text-[#111111]">
              Are you absolutely sure?
            </p>
            <div className="flex gap-2">
              <Button
                title="Cancel"
                variant="ghost"
                fullWidth={false}
                onClick={() => setConfirmDelete(false)}
                testID="delete-account-cancel"
              />
              <Button
                title="Yes, delete permanently"
                variant="primary"
                loading={deleting}
                onClick={performDelete}
                testID="confirm-delete-account"
              />
            </div>
          </div>
        )}
      </ShellPage>
    );
  }

  if (slug === "support") {
    return (
      <ShellPage title="Contact Support" onBack={() => navigate(-1)} testID="settings-support-page">
        <p className="text-[14px] text-[#111111]">
          Our team responds within 24h on weekdays.
        </p>
        <div className="mt-3 overflow-hidden rounded-[12px] border border-[#E5E7EB]">
          <ExternalRow
            Icon={Mail}
            label="support@cargoone.com"
            href="mailto:support@cargoone.com"
            testID="support-email"
          />
          <ExternalRow
            Icon={Mail}
            label="Report a Problem"
            href="mailto:support@cargoone.com?subject=Report a Problem"
            testID="support-report"
          />
          <InternalRow
            Icon={Info}
            label="FAQs"
            to="/faq"
            testID="support-faq"
          />
        </div>
      </ShellPage>
    );
  }

  const content = slug ? CONTENT[slug] : null;
  if (content) {
    return (
      <ShellPage title={content.title} onBack={() => navigate(-1)} testID={`settings-${slug}-page`}>
        <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#111111]">
          {content.body}
        </p>
      </ShellPage>
    );
  }

  // ---- Settings home ----
  return (
    <ShellPage title="Settings" onBack={() => navigate(-1)} testID="settings-home">
      <Section title="Legal">
        <InternalRow Icon={FileText} label="Terms & Conditions" to="/settings/terms" testID="settings-terms" />
        <InternalRow Icon={Lock} label="Privacy Policy" to="/settings/privacy" testID="settings-privacy" />
        <InternalRow Icon={Cookie} label="Cookie Policy" to="/settings/cookies" testID="settings-cookies" />
      </Section>
      <Section title="Support">
        <InternalRow Icon={Mail} label="Contact Support" to="/settings/support" testID="settings-support" />
        <ExternalRow Icon={Star} label="Rate Cargo One" href="mailto:support@cargoone.com?subject=Feedback" testID="settings-rate" />
      </Section>
      <Section title="Account">
        <InternalRow Icon={Info} label="About Cargo One" to="/settings/about" testID="settings-about" />
        <div className="flex items-center gap-3 border-b border-[#F3F4F6] px-4 py-3 last:border-b-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F4F4F4]">
            <Code className="h-5 w-5 text-[#111111]" />
          </span>
          <span className="flex-1 text-[14px] font-semibold text-[#111111]">
            App Version 1.0.0
          </span>
          <span className="rounded-full bg-[#F4F4F4] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.5px] text-[#6B7280]">
            web
          </span>
        </div>
        {user && (
          <InternalRow
            Icon={Trash2}
            label="Delete Account"
            to="/settings/delete-account"
            testID="settings-delete"
            danger
          />
        )}
      </Section>
    </ShellPage>
  );
}

function ShellPage({ title, onBack, testID, children }) {
  return (
    <div className="min-h-screen bg-white pb-8" data-testid={testID}>
      <header className="flex items-center gap-3 border-b border-[#E5E7EB] px-4 py-3 md:px-8">
        <button
          type="button"
          onClick={onBack}
          data-testid="settings-back"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4] hover:bg-[#E5E7EB]"
        >
          <ChevronLeft className="h-5 w-5 text-[#111111]" />
        </button>
        <h1 className="flex-1 text-[20px] font-bold text-[#111111]">{title}</h1>
      </header>
      <div className="mx-auto max-w-[720px] px-4 py-6 md:px-8">{children}</div>
    </div>
  );
}
function Section({ title, children }) {
  return (
    <div className="mb-6">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[1px] text-[#6B7280]">
        {title}
      </p>
      <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white">
        {children}
      </div>
    </div>
  );
}
function InternalRow({ Icon, label, to, testID, danger }) {
  return (
    <Link
      to={to}
      data-testid={testID}
      className="flex items-center gap-3 border-b border-[#F3F4F6] px-4 py-3 last:border-b-0 hover:bg-[#F9FAFB]"
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full ${
          danger ? "bg-[#FEE2E2]" : "bg-[#F4F4F4]"
        }`}
      >
        <Icon className={`h-5 w-5 ${danger ? "text-[#DC2626]" : "text-[#111111]"}`} />
      </span>
      <span className={`flex-1 text-[14px] font-semibold ${danger ? "text-[#DC2626]" : "text-[#111111]"}`}>
        {label}
      </span>
      <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />
    </Link>
  );
}
function ExternalRow({ Icon, label, href, testID }) {
  return (
    <a
      href={href}
      data-testid={testID}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel="noreferrer"
      className="flex items-center gap-3 border-b border-[#F3F4F6] px-4 py-3 last:border-b-0 hover:bg-[#F9FAFB]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F4F4F4]">
        <Icon className="h-5 w-5 text-[#111111]" />
      </span>
      <span className="flex-1 text-[14px] font-semibold text-[#111111]">{label}</span>
      <ExternalLink className="h-4 w-4 text-[#9CA3AF]" />
    </a>
  );
}
