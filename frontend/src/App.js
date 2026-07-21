import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { MarketingLayout } from "@/layouts/MarketingLayout";

// Marketing
import Home from "@/pages/marketing/Home";
import HowItWorks from "@/pages/marketing/HowItWorks";
import Services from "@/pages/marketing/Services";
import Business from "@/pages/marketing/Business";
import Drivers from "@/pages/marketing/Drivers";
import FAQ from "@/pages/marketing/FAQ";
import Contact from "@/pages/marketing/Contact";
import TrustSafety from "@/pages/marketing/TrustSafety";
import About from "@/pages/marketing/About";

// Auth (no marketing chrome)
import Welcome from "@/pages/auth/Welcome";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";

// Portal stubs — full portals arrive in the next Phase 2 stage
import { PortalStub } from "@/pages/portal/PortalStub";

function Marketing({ Page }) {
  return (
    <MarketingLayout>
      <Page />
    </MarketingLayout>
  );
}

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Marketing */}
            <Route path="/" element={<Marketing Page={Home} />} />
            <Route path="/how-it-works" element={<Marketing Page={HowItWorks} />} />
            <Route path="/services" element={<Marketing Page={Services} />} />
            <Route path="/business" element={<Marketing Page={Business} />} />
            <Route path="/drivers" element={<Marketing Page={Drivers} />} />
            <Route path="/faq" element={<Marketing Page={FAQ} />} />
            <Route path="/contact" element={<Marketing Page={Contact} />} />
            <Route path="/trust-safety" element={<Marketing Page={TrustSafety} />} />
            <Route path="/about" element={<Marketing Page={About} />} />

            {/* Auth */}
            <Route path="/auth/welcome" element={<Welcome />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/register" element={<Register />} />

            {/* Portal stubs (full screens ported in next stage) */}
            <Route
              path="/customer/*"
              element={<PortalStub role="customer" title="Customer portal coming next" />}
            />
            <Route
              path="/driver/*"
              element={<PortalStub role="driver" title="Driver portal coming next" />}
            />
            <Route
              path="/admin/*"
              element={<PortalStub role="admin" title="Admin portal coming next" />}
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
