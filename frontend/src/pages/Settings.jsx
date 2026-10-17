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
  KeyRound,
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
export const LEGAL_CONTENT = {
  terms: {
    title: "Terms & Conditions",
    body: `Last updated: 17 October 2026

These Terms & Conditions apply to everyone who uses Cargo One (cargoone.co.uk and the Cargo One customer and driver apps). By creating an account or making a booking you agree to them. If you have a question, contact support@cargoone.co.uk.

1. WHO WE ARE AND WHAT WE DO
Cargo One is an online marketplace. We connect customers who need items moved ("customers") with independent transport providers ("drivers"). The transport itself is carried out by the driver. Cargo One is not a carrier or a removals company, and the contract for the transport job is between the customer and the driver. We provide the platform, the booking and payment tools, messaging, tracking and support.

2. ACCOUNTS
- You must be 18 or over and give accurate details (name, email and phone number).
- Keep your login details safe. You are responsible for activity on your account.
- Drivers must also upload valid documents (for example driving licence, insurance, vehicle registration (V5C), proof of address and a profile photo) and be approved by Cargo One before taking jobs. We may ask for updated documents at any time.

3. HOW BOOKINGS WORK
- Customers post a job with a fixed price, invite bids, or request an ASAP driver. Drivers can accept a fixed price, place a bid, or accept an ASAP request.
- The price for a job is made up of the driver's charge (paid to the driver) and Cargo One's booking fee.
- A booking is confirmed when the customer pays the booking fee (deposit) through Stripe. Contact details and the full addresses are shared with the driver after the booking is confirmed.

4. PAYMENTS
- The booking fee is a percentage of the driver's charge (tiered by job value) and is shown before you pay. It is taken by card through Stripe when the booking is confirmed. Cargo One never stores your card number.
- The driver's charge is paid by the customer directly to the driver on delivery, unless the booking screen says otherwise.
- Prices include everything shown on the booking summary. Extra work agreed between customer and driver on the day is a matter between them.

5. CANCELLATIONS AND REFUNDS (CUSTOMERS)
- Before a driver has accepted your job, you can cancel free of charge and any booking fee you paid is refunded in full.
- After a driver has accepted, you can still cancel in the app up until delivery. We keep a cancellation fee (currently 20% of the booking fee, never more than the amount paid) and the rest is refunded to your card. The app shows the exact fee and refund before you confirm.
- Refunds go back to the original card through Stripe and normally arrive within 5 to 10 working days, depending on your bank.
- Once a job has been delivered it can no longer be cancelled or refunded in the app. If something went wrong, contact support@cargoone.co.uk.

6. CANCELLATIONS BY DRIVERS
- If a driver cancels after accepting, the job is offered to other drivers and your booking fee carries over to the new driver. You will be told when a new driver is assigned.
- You can still cancel the booking yourself under section 5.
- Drivers who cancel repeatedly may be restricted or suspended.

7. CUSTOMER RESPONSIBILITIES
- Describe your items accurately (size, weight, quantity, access) and make sure they are ready for collection and properly packed.
- Do not book the transport of illegal, dangerous or prohibited goods.
- Be available (or have someone available) at collection and delivery.

8. DRIVER RESPONSIBILITIES
- Drivers are independent and responsible for their own vehicle, licence, insurance (including goods-in-transit and public liability where required), tax and legal compliance.
- Drivers must carry out jobs safely and professionally, keep status updates accurate, and upload proof of delivery.
- Drivers must not ask customers to pay outside the agreed price or move bookings off the platform.

9. RATINGS, REVIEWS AND MESSAGES
Reviews and messages must be honest and respectful. We may remove content that is abusive, misleading or breaks the law.

10. LIABILITY
- Cargo One provides the platform with reasonable care and skill, but we do not guarantee that a driver will be available for every job or that the platform will always be uninterrupted.
- Because the transport is carried out by the driver, loss of or damage to goods in transit is a matter for the driver and their insurance. We will help customers and drivers resolve disputes where we can.
- Nothing in these terms limits liability for death or personal injury caused by negligence, for fraud, or for anything that cannot be limited under UK law, and nothing affects your statutory rights as a consumer.

11. SUSPENSION AND ACCOUNT DELETION
- We may suspend or close accounts that break these terms, provide false information or put other users at risk.
- You can delete your account at any time in the app (Settings → Delete account) or on the website, as long as you have no active booking. See our Privacy Policy for what happens to your data.

12. CHANGES
We may update these terms. If we make important changes we will tell you in the app or by email. The "Last updated" date shows the current version.

13. GOVERNING LAW
These terms are governed by the law of England and Wales, and the courts of England and Wales have jurisdiction.

14. CONTACT
Cargo One — cargoone.co.uk — support@cargoone.co.uk`,
  },
  privacy: {
    title: "Privacy Policy",
    body: `Last updated: 17 October 2026

This policy explains, in plain English, what personal data Cargo One collects, why, who we share it with, and your rights. It applies to customers, drivers and admin users of cargoone.co.uk and the Cargo One customer and driver apps.

1. WHO WE ARE
Cargo One (cargoone.co.uk) is the data controller for the personal data described here. Contact us about anything in this policy at support@cargoone.co.uk.

2. WHAT WE COLLECT
- Account details: name, email address, phone number, password (stored only as a secure hash), profile photo if you add one, and passkey/Face ID sign-in records (we never receive your fingerprint or face data).
- Job and booking details: collection and delivery addresses, item descriptions, sizes, weights and photos, dates, prices, and booking status history.
- Driver documents: driving licence, insurance certificates, vehicle registration (V5C), proof of address, profile photo and vehicle details, used to verify drivers.
- Driver location: when a driver is online (Live Mode) or on an active job, the driver app shares the driver's location while the app is open in the foreground. We use it to offer nearby jobs and to show the customer live tracking and arrival times. We do not track drivers in the background or when they are offline.
- Customer location: only if you allow it, to show your position on the map. We do not store it.
- Proof of delivery: photos, signature and notes uploaded by the driver.
- Messages between customer and driver, and ratings and reviews.
- Payment information: payments are processed by Stripe. We receive payment confirmations, amounts and refund status, but we never see or store your full card number.
- Device push tokens, so we can send booking and job notifications.
- Technical data: basic server logs (for example IP address, device and browser type, and error details) used for security and troubleshooting.

3. WHY WE USE IT AND OUR LAWFUL BASES (UK GDPR)
- To create your account, take bookings, match customers with drivers, show tracking, handle payments and refunds, and provide support. Lawful basis: performance of our contract with you.
- To verify drivers, keep the platform safe and prevent fraud and misuse. Lawful basis: our legitimate interests in running a safe marketplace, and legal obligations where they apply.
- To keep financial and tax records. Lawful basis: legal obligation.
- To send service messages (booking updates, receipts, password resets) by email and push notification. Lawful basis: performance of our contract.
- Location sharing in the apps uses your device permission, which you can turn off at any time in your phone's settings.

4. WHO WE SHARE IT WITH
- The other party on a booking: drivers see the customer's name, contact number and addresses for their job once it is confirmed; customers see their driver's name, photo, vehicle, rating, contact number and live location during the job.
- Stripe (payments and refunds).
- Google Maps Platform (address search, geocoding and distance/journey time).
- Mapbox (maps in the apps).
- Our email provider, for transactional emails such as receipts and password resets.
- Expo and Apple push notification services, to deliver app notifications.
- Our hosting and infrastructure providers, who store and run the service on our behalf.
- The police or other authorities where the law requires it.
We do not sell your personal data, and we do not share it with advertisers.

5. HOW LONG WE KEEP IT
- Account data is kept while your account is active.
- Booking, payment and invoice records are kept for as long as required for tax and accounting, typically 6 years.
- Driver documents are deleted when the driver account is deleted (or earlier when replaced).
- Server logs are kept for a short period for security and troubleshooting.

6. DELETING YOUR ACCOUNT
You can delete your account in the app (Settings → Delete account) or on the website (Settings → Delete account), as long as you do not have an active booking. When you delete your account we remove your documents and notifications and anonymise your personal details (your name, email address, phone number and profile photo are removed, and your name is replaced with "Deleted user" on past bookings, messages and reviews). Booking and payment records are kept in anonymised form where the law requires us to keep financial records. You will no longer be able to sign in.

7. COOKIES
We only use essential cookies and browser storage to keep you signed in and secure. We do not use analytics or advertising cookies, and the apps do not use advertising trackers. See our Cookie Policy at cargoone.co.uk/cookies.

8. YOUR RIGHTS
Under UK GDPR you have the right to access your data, correct it, have it erased, restrict or object to how we use it, and receive a copy in a portable format. To use any of these rights, email support@cargoone.co.uk. We will reply within one month. If you are unhappy with how we handle your data you can complain to the Information Commissioner's Office (ico.org.uk).

9. CHILDREN
Cargo One is not intended for anyone under 18, and we do not knowingly collect data from children.

10. INTERNATIONAL TRANSFERS
Some of our providers (for example Stripe, Google, Mapbox and our hosting providers) may process data outside the UK. Where that happens we rely on appropriate safeguards such as the UK International Data Transfer Agreement, the UK Addendum to the EU Standard Contractual Clauses, or UK adequacy regulations.

11. CHANGES TO THIS POLICY
We may update this policy. If we make important changes we will tell you in the app or by email. The "Last updated" date shows the current version.

12. CONTACT
Cargo One — cargoone.co.uk — support@cargoone.co.uk`,
  },
  cookies: {
    title: "Cookie Policy",
    body: `Last updated: 17 October 2026

ESSENTIAL
Cargo One uses essential cookies and browser storage to keep you signed in, protect your account (security and anti-forgery tokens) and remember that you have seen our cookie notice. The site cannot work without these, so they do not need your consent.

ANALYTICS AND ADVERTISING
We do not use analytics, tracking or advertising cookies on the website, and the apps do not use advertising trackers.

QUESTIONS
Contact support@cargoone.co.uk. See also our Privacy Policy at cargoone.co.uk/privacy.`,
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

  const content = slug ? LEGAL_CONTENT[slug] : null;
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
        {user && (
          <InternalRow
            Icon={KeyRound}
            label="Passkeys (Face ID / Touch ID)"
            to="/settings/passkeys"
            testID="settings-passkeys"
          />
        )}
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
