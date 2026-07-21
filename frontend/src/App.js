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

// Customer portal — Stage 2A-i (foundation) + Stage 2A-ii (active workflows)
import CustomerDashboard from "@/pages/portal/customer/Dashboard";
import CustomerBookings from "@/pages/portal/customer/Bookings";
import CustomerMessages from "@/pages/portal/customer/Messages";
import CustomerProfile from "@/pages/portal/customer/Profile";
import CustomerPostJob from "@/pages/portal/customer/PostJob";
import CustomerJobDetail from "@/pages/portal/customer/JobDetail";
import CustomerBookingDetail from "@/pages/portal/customer/BookingDetail";

// Driver portal — Stage 2B
import DriverDashboard from "@/pages/portal/driver/Dashboard";
import DriverJobs from "@/pages/portal/driver/Jobs";
import DriverJobDetail from "@/pages/portal/driver/JobDetail";
import DriverMyJobs from "@/pages/portal/driver/MyJobs";
import DriverBookingDetail from "@/pages/portal/driver/BookingDetail";
import DriverEarnings from "@/pages/portal/driver/Earnings";
import DriverFleet from "@/pages/portal/driver/Fleet";
import DriverDocuments from "@/pages/portal/driver/Documents";
import DriverProfile from "@/pages/portal/driver/Profile";
import { DriverLayout } from "@/layouts/DriverLayout";

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

function Driver({ Page }) {
  return (
    <DriverLayout>
      <Page />
    </DriverLayout>
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
            {/* Stage 2A-ii — active workflows */}
            <Route
              path="/customer/post-job"
              element={<Customer Page={CustomerPostJob} />}
            />
            <Route
              path="/customer/booking/:id"
              element={<Customer Page={CustomerBookingDetail} />}
            />
            <Route
              path="/customer/job/:id"
              element={<Customer Page={CustomerJobDetail} />}
            />
            {/* Catch any /customer/* not yet ported */}
            <Route
              path="/customer/*"
              element={<Customer Page={CustomerDashboard} />}
            />

            {/* Driver portal — Stage 2B */}
            <Route path="/driver" element={<Driver Page={DriverDashboard} />} />
            <Route path="/driver/jobs" element={<Driver Page={DriverJobs} />} />
            <Route path="/driver/job/:id" element={<Driver Page={DriverJobDetail} />} />
            <Route path="/driver/my-jobs" element={<Driver Page={DriverMyJobs} />} />
            <Route path="/driver/booking/:id" element={<Driver Page={DriverBookingDetail} />} />
            <Route path="/driver/earnings" element={<Driver Page={DriverEarnings} />} />
            <Route path="/driver/fleet" element={<Driver Page={DriverFleet} />} />
            <Route path="/driver/documents" element={<Driver Page={DriverDocuments} />} />
            <Route path="/driver/profile" element={<Driver Page={DriverProfile} />} />
            <Route path="/driver/*" element={<Driver Page={DriverDashboard} />} />

            {/* Admin portal — Stage 2C */}
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
