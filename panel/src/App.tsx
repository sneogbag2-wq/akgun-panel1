// src/App.tsx
import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import AiChatPanel from './components/ai/AiChatPanel';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { waitForInit } from './services/customerService';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CariPage = lazy(() => import('./pages/CariPage'));
const FaturaKontrolPage = lazy(() => import('./pages/FaturaKontrolPage'));
const SevkiyatTakipPage = lazy(() => import('./pages/SevkiyatTakipPage'));
const SelloutHedefPage = lazy(() => import('./pages/SelloutHedefPage'));

// Yeni AI Modülleri
const AiRiskAnalysisPage = lazy(() => import('./pages/AiRiskAnalysisPage'));
const AiRepPerformancePage = lazy(() => import('./pages/AiRepPerformancePage'));
const AiLogisticsPage = lazy(() => import('./pages/AiLogisticsPage'));

function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '400px',
      width: '100%',
      flexDirection: 'column',
      gap: '12px',
      fontFamily: 'Inter, sans-serif',
      color: '#64748B'
    }}>
      <div style={{
        width: '32px', height: '32px',
        border: '3px solid #CBD5E1',
        borderTopColor: '#8A6D1F',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Sayfa yükleniyor...</span>
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initPromise = waitForInit();
    if (initPromise) {
      initPromise
        .then(() => setReady(true))
        .catch(() => setReady(true));
    } else {
      setReady(true);
    }
  }, []);

  if (!ready) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#EEF1F6',
        flexDirection: 'column',
        gap: '16px',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{
          width: '40px', height: '40px',
          border: '3px solid #DBE2EC',
          borderTopColor: '#8A6D1F',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ color: '#71809A', fontSize: '0.875rem', fontWeight: 600 }}>
          Veriler yükleniyor...
        </span>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <MainLayout>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/"               element={<DashboardPage />} />
              <Route path="/cari"           element={<CariPage />} />
              <Route path="/fatura-kontrol" element={<FaturaKontrolPage />} />
              <Route path="/sevkiyat-takip" element={<SevkiyatTakipPage />} />
              <Route path="/hedef-sellout"  element={<SelloutHedefPage />} />
              
              {/* AI Asistan (Günlü) Modülleri */}
              <Route path="/ai-risk"        element={<AiRiskAnalysisPage />} />
              <Route path="/ai-temsilci"    element={<AiRepPerformancePage />} />
              <Route path="/ai-lojistik"    element={<AiLogisticsPage />} />
              <Route path="/ai-asistan"     element={<AiRiskAnalysisPage />} /> {/* Redirect fallback */}

              <Route path="*"               element={<DashboardPage />} />
            </Routes>
          </Suspense>
          <AiChatPanel />
        </MainLayout>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
