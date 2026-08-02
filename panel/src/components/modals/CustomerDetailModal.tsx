import { useState } from 'react';
import { createPortal } from 'react-dom';
import CustomerInvoicesBody from './CustomerInvoicesBody';
import CustomerStatementBody from './CustomerStatementBody';
import CustomerAnalysisBody from './CustomerAnalysisBody';
import ChequeSenetBody from './ChequeSenetBody';
import CustomerHeaderAIInsight from './CustomerHeaderAIInsight';
import CariModalIcons from './CariModalIcons';
import CopyBadge from '../common/CopyBadge';
import { formatCurrency } from '../../utils/formatters';
import './CariModalV2.css';

interface Props {
  customer: any;
  initialTab?: 'INVOICES' | 'STATEMENT' | 'ANALYSIS' | 'CHEQUE';
  onClose: () => void;
}

export default function CustomerDetailModal({ customer, initialTab = 'INVOICES', onClose }: Props) {
  const [activeTab, setActiveTab] = useState(initialTab);

  if (!customer) return null;

  const totalChequeRisk = customer.cekSenetRisk || customer.cekSenet || 0;
  const showChequeTab = customer.cekSenet > 0 || totalChequeRisk > 0 || customer.customerId === 'GLOBAL';

  return createPortal(
    <div className="cari-v2-overlay" style={{ zIndex: 1100 }} onClick={onClose}>
      <div className="cari-v2" onClick={(e) => e.stopPropagation()}>
        <CariModalIcons />

        <div className="cv2-shell">
          {/* Header */}
          <div className="cv2-head">
            <div className="cv2-head-left">
              <div className="cv2-avatar"><svg className="cv2-ic"><use href="#i-user" /></svg></div>
              <div>
                <h1 className="cv2-cust-name">{customer.signName || customer.customerName}</h1>
                <div className="cv2-meta-row">
                  <span className="cv2-meta-item">
                    <svg className="cv2-ic"><use href="#i-id" /></svg> Cari Kod <b>{customer.customerId}</b>
                  </span>
                  <CopyBadge textToCopy={customer.customerId} className="cv2-copy-mini" />
                  <span className="cv2-meta-dot" />
                  <span className="cv2-meta-item">
                    <svg className="cv2-ic"><use href="#i-user" /></svg> Temsilci <b>{customer.salesRepName || 'Key Account'}</b>
                  </span>
                  {customer.customerId !== 'GLOBAL' && (
                    <>
                      <span className="cv2-meta-dot" />
                      <span className="cv2-meta-item cv2-balance">
                        <svg className="cv2-ic"><use href="#i-wallet" /></svg> Açık Bakiye <b>{formatCurrency(customer.balance)}</b>
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button className="cv2-btn-close" onClick={onClose} aria-label="Kapat">
                <svg className="cv2-ic"><use href="#i-x" /></svg>
              </button>
            </div>
          </div>

          <CustomerHeaderAIInsight customer={customer} activeTab={activeTab} />

          {/* Tabs */}
          <nav className="cv2-tabs">
            <button className={`cv2-tab ${activeTab === 'INVOICES' ? 'active' : ''}`} onClick={() => setActiveTab('INVOICES')}>
              <svg className="cv2-ic"><use href="#i-invoice" /></svg>Faturalar
            </button>
            <button className={`cv2-tab ${activeTab === 'STATEMENT' ? 'active' : ''}`} onClick={() => setActiveTab('STATEMENT')}>
              <svg className="cv2-ic"><use href="#i-receipt" /></svg>Ekstre
            </button>
            <button className={`cv2-tab ${activeTab === 'ANALYSIS' ? 'active' : ''}`} onClick={() => setActiveTab('ANALYSIS')}>
              <svg className="cv2-ic"><use href="#i-chart" /></svg>Analiz
            </button>
            {showChequeTab && (
              <button className={`cv2-tab ${activeTab === 'CHEQUE' ? 'active' : ''}`} onClick={() => setActiveTab('CHEQUE')}>
                <svg className="cv2-ic"><use href="#i-cheque" /></svg>Çek/Senet
              </button>
            )}
          </nav>

          {/* Body */}
          <div className="cv2-body">
            {activeTab === 'INVOICES' && <CustomerInvoicesBody customer={customer} />}
            {activeTab === 'STATEMENT' && <CustomerStatementBody customer={customer} />}
            {activeTab === 'ANALYSIS' && <CustomerAnalysisBody customer={customer} />}
            {activeTab === 'CHEQUE' && <ChequeSenetBody customer={customer} onDataChange={() => {}} />}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
