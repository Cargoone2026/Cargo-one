import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ScrollToTop } from "@/components/ScrollToTop";
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

// Public app pages (no chrome)
import Settings from "@/pages/Settings";
import DriverProfilePublic from "@/pages/DriverProfilePublic";

// Auth (no marketing chrome)
import Welcome from "@/pages/auth/Welcome";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";

// Customer portal — Stage 2A-i (foundation) + Stage 2A-ii (active workflows)
import CustomerDashboard from "@/pages/portal/customer/Dashboard";
import CustomerBookings from "@/pages/portal/customer/Bookings";
import CustomerMessages from "@/pages/portal/customer/Messages";
import CustomerProfile from "@/pages/portal/customer/Profile";
import CustomerPostJob from "@/pages/portal/customer/PostJob";
import CustomerAsapRequest from "@/pages/portal/customer/AsapRequest";
import CustomerDispatch from "@/pages/portal/customer/Dispatch";
import CustomerJobDetail from "@/pages/portal/customer/JobDetail";
import CustomerBookingDetail from "@/pages/portal/customer/BookingDetail";
import CustomerBookingConfirmed from "@/pages/portal/customer/BookingConfirmed";

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
import DriverLive from "@/pages/portal/driver/Live";
import DriverNotifications from "@/pages/portal/driver/Notifications";
import { DriverLayout } from "@/layouts/DriverLayout";

// Admin portal — Stage 2C
import AdminDashboard from "@/pages/portal/admin/Dashboard";
import AdminAnalytics from "@/pages/portal/admin/Analytics";
import AdminUsers from "@/pages/portal/admin/Users";
import AdminDrivers from "@/pages/portal/admin/Drivers";
import AdminDriverDetail from "@/pages/portal/admin/DriverDetail";
import AdminJobs from "@/pages/portal/admin/Jobs";
import AdminBookings from "@/pages/portal/admin/Bookings";
import AdminCatalog from "@/pages/portal/admin/Catalog";
import AdminDepositBands from "@/pages/portal/admin/DepositBands";
import AdminBookingFeeBands from "@/pages/portal/admin/BookingFeeBands";
import AdminDispatchMonitor from "@/pages/portal/admin/DispatchMonitor";
import AdminQueues from "@/pages/portal/admin/Queues";
import AdminProfile from "@/pages/portal/admin/Profile";
import { AdminLayout } from "@/layouts/AdminLayout";

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

function Admin({ Page }) {
  return (
    <AdminLayout>
      <Page />
    </AdminLayout>
  );
}

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <ScrollToTop />
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
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/reset" element={<ResetPassword />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />

            {/* Settings hub + public driver profile (parity with Expo) */}
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/:slug" element={<Settings />} />
            <Route path="/driver-profile/:id" element={<DriverProfilePublic />} />

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
              path="/customer/asap"
              element={<Customer Page={CustomerAsapRequest} />}
            />
            <Route
              path="/customer/dispatch/:jobId"
              element={<Customer Page={CustomerDispatch} />}
            />
            <Route
              path="/customer/booking/:id"
              element={<Customer Page={CustomerBookingDetail} />}
            />
            <Route
              path="/customer/booking-confirmed/:id"
              element={<Customer Page={CustomerBookingConfirmed} />}
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
            <Route path="/driver/live" element={<Driver Page={DriverLive} />} />
            <Route path="/driver/booking/:id" element={<Driver Page={DriverBookingDetail} />} />
            <Route path="/driver/earnings" element={<Driver Page={DriverEarnings} />} />
            <Route path="/driver/fleet" element={<Driver Page={DriverFleet} />} />
            <Route path="/driver/documents" element={<Driver Page={DriverDocuments} />} />
            <Route path="/driver/profile" element={<Driver Page={DriverProfile} />} />
            <Route path="/driver/notifications" element={<Driver Page={DriverNotifications} />} />
            <Route path="/driver/*" element={<Driver Page={DriverDashboard} />} />

            {/* Admin portal — Stage 2C */}
            <Route path="/admin" element={<Admin Page={AdminDashboard} />} />
            <Route path="/admin/analytics" element={<Admin Page={AdminAnalytics} />} />
            <Route path="/admin/users" element={<Admin Page={AdminUsers} />} />
            <Route path="/admin/drivers" element={<Admin Page={AdminDrivers} />} />
            <Route path="/admin/driver/:id" element={<Admin Page={AdminDriverDetail} />} />
            <Route path="/admin/jobs" element={<Admin Page={AdminJobs} />} />
            <Route path="/admin/bookings" element={<Admin Page={AdminBookings} />} />
            <Route path="/admin/catalog" element={<Admin Page={AdminCatalog} />} />
            <Route path="/admin/deposit-bands" element={<Admin Page={AdminDepositBands} />} />
            <Route path="/admin/booking-fee-bands" element={<Admin Page={AdminBookingFeeBands} />} />
            <Route path="/admin/dispatch" element={<Admin Page={AdminDispatchMonitor} />} />
            <Route path="/admin/queues" element={<Admin Page={AdminQueues} />} />
            <Route path="/admin/profile" element={<Admin Page={AdminProfile} />} />
            <Route path="/admin/*" element={<Admin Page={AdminDashboard} />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
