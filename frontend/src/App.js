import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { MarketingLayout } from "@/layouts/MarketingLayout";
import { CustomerLayout } from "@/layouts/CustomerLayout";

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

// Customer portal — Stage 2A-i
import CustomerDashboard from "@/pages/portal/customer/Dashboard";
import CustomerBookings from "@/pages/portal/customer/Bookings";
import CustomerMessages from "@/pages/portal/customer/Messages";
import CustomerProfile from "@/pages/portal/customer/Profile";
import ComingNext from "@/pages/portal/customer/ComingNext";

// Driver / Admin portal stubs (Stages 2B / 2C)
import { PortalStub } from "@/pages/portal/PortalStub";

function Marketing({ Page }) {
  return (
    <MarketingLayout>
      <Page />
    </MarketingLayout>
  );
}

function Customer({ Page }) {
  return (
    <CustomerLayout>
      <Page />
    </CustomerLayout>
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

            {/* Customer portal — Stage 2A-i */}
            <Route path="/customer" element={<Customer Page={CustomerDashboard} />} />
            <Route
              path="/customer/bookings"
              element={<Customer Page={CustomerBookings} />}
            />
            <Route
              path="/customer/messages"
              element={<Customer Page={CustomerMessages} />}
            />
            <Route
              path="/customer/profile"
              element={<Customer Page={CustomerProfile} />}
            />
            {/* Stage 2A-ii placeholders — graceful landings so hero + cards work */}
            <Route
              path="/customer/post-job"
              element={
                <Customer
                  Page={() => <ComingNext area="Post Job wizard" />}
                />
              }
            />
            <Route
              path="/customer/booking/:id"
              element={
                <Customer
                  Page={() => <ComingNext area="Booking detail" />}
                />
              }
            />
            <Route
              path="/customer/job/:id"
              element={
                <Customer
                  Page={() => <ComingNext area="Job detail" />}
                />
              }
            />
            {/* Catch any /customer/* not yet ported */}
            <Route
              path="/customer/*"
              element={<Customer Page={CustomerDashboard} />}
            />

            {/* Driver / Admin portals — ported in later stages */}
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
