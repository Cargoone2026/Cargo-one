import React from "react";
import { Link } from "react-router-dom";
import { Car, Package } from "lucide-react";
import { IMG } from "@/components/marketing/images";
import { SEO } from "@/components/marketing/SEO";

export default function Welcome() {
  return (
    <>
      <SEO
        title="Welcome to Cargo One"
        description="Ship anything. Anywhere. Instant quotes. Trusted drivers. Live tracking."
        path="/auth/welcome"
        image={IMG.heroWelcome}
      />
      <div
        className="relative min-h-screen w-full bg-black"
        data-testid="welcome-screen"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.85) 55%, #000 100%), url("${IMG.heroWelcome}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="mx-auto flex min-h-screen w-full max-w-[600px] flex-col justify-between px-6 py-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#D62828]">
              <Package className="h-5 w-5 text-white" strokeWidth={2.4} />
            </div>
            <span className="text-[16px] font-bold tracking-[2px] text-white">
              CARGO ONE
            </span>
          </div>

          <div className="pb-6">
            <h1 className="whitespace-pre-line text-[44px] font-bold leading-[1.05] tracking-[-1px] text-white">
              {"Ship Anything.\nAnywhere."}
            </h1>
            <p className="mt-3 text-[16px] leading-relaxed text-white/75">
              Instant Quotes. Trusted Drivers. Live Tracking.
            </p>
          </div>

          <div className="space-y-4 pb-3">
            <Link
              to="/auth/register?role=customer"
              data-testid="get-started-button"
              className="block w-full rounded-full bg-[#D62828] px-6 py-4 text-center text-[16px] font-bold text-white transition-colors hover:bg-[#B01F1F]"
            >
              Get Started
            </Link>
            <Link
              to="/auth/login"
              data-testid="have-account-button"
              className="block py-2 text-center text-[14px] text-white/70"
            >
              Already have an account?{" "}
              <span className="font-semibold text-white">Log in</span>
            </Link>
            <Link
              to="/auth/register?role=driver"
              data-testid="become-driver-button"
              className="flex items-center justify-center gap-2 rounded-full border border-white/30 py-3 text-[14px] font-semibold text-white"
            >
              <Car className="h-[18px] w-[18px]" />
              Become a Driver
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
