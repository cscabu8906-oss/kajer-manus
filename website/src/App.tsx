import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { BookingPage, FindWorkersPage, ServiceDetailPage, ServicesListPage, WorkerProfilePage } from './pages/MarketplacePages';
import { ForgotPasswordPage, LoginPage, RegisterPage } from './pages/AuthPages';
import { CustomerDashboardPage } from './pages/CustomerDashboardPage';
import { ProviderDashboardPage } from './pages/ProviderDashboardPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AboutPage, ContactPage, DownloadAppPage, PolicyPage } from './pages/StaticPages';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/services" element={<ServicesListPage />} />
            <Route path="/services/:id" element={<ServiceDetailPage />} />
            <Route path="/workers" element={<FindWorkersPage />} />
            <Route path="/workers/:id" element={<WorkerProfilePage />} />
            <Route path="/book" element={<BookingPage />} />
            <Route path="/book/:serviceId" element={<BookingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-otp" element={<Navigate to="/forgot-password" replace />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/dashboard" element={<CustomerDashboardPage />} />
            <Route path="/provider/dashboard" element={<ProviderDashboardPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy-policy" element={<PolicyPage type="privacy" />} />
            <Route path="/terms" element={<PolicyPage type="terms" />} />
            <Route path="/cancellation-policy" element={<PolicyPage type="cancellation" />} />
            <Route path="/download-app" element={<DownloadAppPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
