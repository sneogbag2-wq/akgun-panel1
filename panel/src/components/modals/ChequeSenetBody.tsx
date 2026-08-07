// src/components/modals/ChequeSenetModal.tsx
// Müşteri Çek & Senet Portföy, Risk Detayı ve Manuel Yönetim (CRUD) Modalı

import React, { useState, useEffect, useMemo } from 'react';
import {
  formatCurrency,
  formatDate,
  getCustomerCheques,
  addManualCheque,
  updateManualCheque,
  deleteManualCheque,
  getAllCustomersForReportingSync,
} from '../../services/customerService';
import { exportToCorporateExcel, printReportHTML } from '../../utils/exportUtils';
import CopyBadge from '../common/CopyBadge';
import { isAdminAuthenticated, subscribeAdminAuthChange } from '../../services/customRulesService';

interface Props {
  customer: any;
  onDataChange?: () => void;
}

export default function ChequeSenetBody({ customer, onDataChange }: Props) {
  const [isAdmin, setIsAdmin] = useState(isAdminAuthenticated());
  const [cheques, setCheques] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  useEffect(() => {
    return subscribeAdminAuthChange(() => setIsAdmin(isAdminAuthenticated()));
  }, []);

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'dueDate', direction: 'asc' });
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterRep, setFilterRep] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const allCustomers = useMemo(() => getAllCustomersForReportingSync(), []);
  
  const repMap = useMemo(() => {
    const map: Record<string, string> = {};
    allCustomers.forEach(c => {
      map[c.customerId] = c.salesRepName || 'Key Account';
    });
    return map;
  }, [allCustomers]);

  const uniqueReps = useMemo(() => {
    return [...new Set(Object.values(repMap))].sort();
  }, [repMap]);

  const [formData, setFormData] = useState({
    type: 'ÇEK',
    docNo: '',
    subNo: '',
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    amount: '',
    bankName: '',
    description: '',
    status: 'PORTFOY',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const fetchId = customer?.customerId === 'GLOBAL' ? null : customer?.customerId;
      const list = await getCustomerCheques(fetchId);
      setCheques(list);
    } catch (e) {
      console.error('Çek listesi okuma hatası:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customer) {
      loadData();
    }
  }, [customer]);

  const isActiveRiskStatus = (status?: string) => {
    const st = status || 'PORTFOY';
    return st !== 'ODENDI' && st !== 'TAHSIL_EDILDI' && st !== 'IADE' && st !== 'KARSILIKSIZ' && st !== 'CANCELLED';
  };

  const totalChequeRisk = cheques.filter(c => isActiveRiskStatus(c.status)).reduce((s, c) => s + (c.amount || 0), 0);
  const cekList = cheques.filter((c) => c.type === 'ÇEK' && isActiveRiskStatus(c.status));
  const senetList = cheques.filter((c) => c.type === 'SENET' && isActiveRiskStatus(c.status));

  const cekSum = cekList.reduce((s, c) => s + (c.amount || 0), 0);
  const senetSum = senetList.reduce((s, c) => s + (c.amount || 0), 0);

  const upcomingMonthBreakdown = useMemo(() => {
    const monthsMap: Record<string, { key: string; label: string; count: number; sum: number }> = {};
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    cheques.filter(c => isActiveRiskStatus(c.status)).forEach(c => {
      if (!c.dueDate) return;
      const date = new Date(c.dueDate);
      if (isNaN(date.getTime())) return;
      if (date < todayStart) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthNames = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
      const label = `${monthNames[date.getMonth() + 1]} ${date.getFullYear()}`;
      
      if (!monthsMap[key]) {
        monthsMap[key] = { key, label, count: 0, sum: 0 };
      }
      monthsMap[key].count++;
      monthsMap[key].sum += (c.amount || 0);
    });

    return Object.values(monthsMap).sort((a, b) => a.key.localeCompare(b.key)).slice(0, 3);
  }, [cheques]);

  const overdueBreakdown = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    let count = 0;
    let sum = 0;
    cheques.filter(c => isActiveRiskStatus(c.status)).forEach(c => {
      if (!c.dueDate) return;
      const date = new Date(c.dueDate);
      if (isNaN(date.getTime())) return;
      if (date >= todayStart) return;
      count++;
      sum += (c.amount || 0);
    });
    return { count, sum };
  }, [cheques]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedCheques = useMemo(() => {
    let result = [...cheques];

    if (filterStatus !== 'ALL') {
      result = result.filter(c => (c.status || 'PORTFOY') === filterStatus);
    }

    if (filterText) {
      const q = filterText.toLowerCase();
      result = result.filter(c => 
        (c.customerName || '').toLowerCase().includes(q) ||
        (c.customerId || '').toLowerCase().includes(q) ||
        (c.docNo || '').toLowerCase().includes(q) ||
        (c.subNo || '').toLowerCase().includes(q) ||
        (c.bankName || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q)
      );
    }

    if (filterRep !== 'ALL') {
      result = result.filter(c => repMap[c.customerId] === filterRep);
    }

    if (startDate) {
      result = result.filter(c => new Date(c.dueDate) >= new Date(startDate));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter(c => new Date(c.dueDate) <= end);
    }

    result.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'amount') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      } else if (sortConfig.key === 'issueDate' || sortConfig.key === 'dueDate') {
        aVal = new Date(aVal || 0).getTime();
        bVal = new Date(bVal || 0).getTime();
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [cheques, sortConfig, filterText, filterStatus, filterRep, startDate, endDate, repMap]);

  const getVadeBadge = (dueDate: string, status: string) => {
    const st = status || 'PORTFOY';
    if (st === 'ODENDI' || st === 'TAHSIL_EDILDI') {
      return <span className="cv2-days-badge low">Ödendi</span>;
    }
    if (st === 'IADE' || st === 'KARSILIKSIZ' || st === 'CANCELLED') {
      return <span className="cv2-days-badge high">İade</span>;
    }

    if (!dueDate) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return <span className="cv2-days-badge high" style={{ background: 'var(--cv2-red)', color: '#fff', boxShadow: '0 0 8px rgba(251,123,133,0.5)' }}>BUGÜN VADELİ</span>;
    }
    if (diffDays < 0) {
      return <span className="cv2-days-badge high">{Math.abs(diffDays)} Gün Geçti</span>;
    }
    return <span className="cv2-days-badge low">{diffDays} Gün Var</span>;
  };

  const handleExportExcel = () => {
    if (!filteredAndSortedCheques.length) return;
    exportToCorporateExcel({
      title: 'ÇEK & SENET PORTFÖYÜ VE RİSK RAPORU',
      customer,
      subtitle: `Toplam ${filteredAndSortedCheques.length} Evrak`,
      fileName: `Cek_Senet_Portfoyu_${customer?.customerId || 'GLOBAL'}_${Date.now()}.xlsx`,
      sheetName: 'Portfoy',
      columns: [
        { header: 'Tür', excelValue: (c: any) => c.type },
        { header: 'Cari Adı / Firma', excelValue: (c: any) => c.customerName || c.customerId || '-' },
        { header: 'Belge / Seri No', excelValue: (c: any) => c.docNo || '-' },
        { header: 'Çek/Senet No', excelValue: (c: any) => c.subNo || '-' },
        { header: 'İşlem Tarihi', excelValue: (c: any) => formatDate(c.issueDate) },
        { header: 'Vade Tarihi', excelValue: (c: any) => formatDate(c.dueDate) },
        { header: 'Banka / Açıklama', excelValue: (c: any) => c.bankName || c.description || '-' },
        { header: 'Tutar (TL)', key: 'amount', isNumeric: true, excelValue: (c: any) => c.amount || 0 },
        { header: 'Durum', excelValue: (c: any) => c.status || 'PORTFOY' }
      ],
      rows: filteredAndSortedCheques
    });
  };

  const handlePrintPDF = () => {
    if (!filteredAndSortedCheques.length) return;
    printReportHTML({
      title: 'ÇEK & SENET PORTFÖYÜ VE RİSK RAPORU',
      customer,
      subtitle: `Toplam ${filteredAndSortedCheques.length} Evrak`,
      summaryBoxes: [
        { label: 'TOPLAM RİSK', value: formatCurrency(totalChequeRisk), color: '#ec4899' },
        { label: 'ÇEK PORTFÖYÜ', value: formatCurrency(cekSum), color: '#2563eb' },
        { label: 'SENET PORTFÖYÜ', value: formatCurrency(senetSum), color: '#8b5cf6' }
      ],
      columns: [
        { header: 'Tür', render: (r: any) => r.type },
        { header: 'Cari Adı', render: (r: any) => r.customerName || r.customerId || '-' },
        { header: 'Belge No', render: (r: any) => `${r.docNo || ''} ${r.subNo ? '/ '+r.subNo : ''}` },
        { header: 'İşlem Tarihi', render: (r: any) => formatDate(r.issueDate) },
        { header: 'Vade Tarihi', render: (r: any) => formatDate(r.dueDate) },
        { header: 'Banka / Açıklama', render: (r: any) => r.bankName || r.description || '-' },
        { header: 'Tutar (TL)', align: 'right', render: (r: any) => formatCurrency(r.amount) },
        { header: 'Durum', render: (r: any) => r.status || 'PORTFOY' }
      ],
      rows: filteredAndSortedCheques
    });
  };

  const resetForm = () => {
    setFormData({
      type: 'ÇEK',
      docNo: '',
      subNo: '',
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: '',
      amount: '',
      bankName: '',
      description: '',
      status: 'PORTFOY',
    });
    setShowAddForm(false);
    setEditingItem(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.dueDate) {
      alert('Lütfen Tutar ve Vade Tarihi alanlarını doldurunuz.');
      return;
    }

    try {
      const payload = {
        ...formData,
        customerId: customer.customerId === 'GLOBAL' ? '5000078523' : customer.customerId,
        customerName: customer.customerId === 'GLOBAL' ? 'MANUEL KAYIT' : (customer.signName || customer.customerName),
        amount: parseFloat(formData.amount),
      };

      if (editingItem) {
        const itemId = editingItem.id || editingItem.chequeId || (editingItem.docNo && editingItem.subNo ? `${editingItem.docNo}_${editingItem.subNo}` : editingItem.docNo);
        await updateManualCheque(itemId, payload);
      } else {
        await addManualCheque(payload);
      }

      resetForm();
      await loadData();
      if (onDataChange) onDataChange();
    } catch (err: any) {
      console.error('Kayıt oluşturma hatası:', err);
      alert(`Kayıt kaydedilirken hata oluştu: ${err.message}`);
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      type: item.type || 'ÇEK',
      docNo: item.docNo || '',
      subNo: item.subNo || '',
      issueDate: item.issueDate ? item.issueDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      dueDate: item.dueDate ? item.dueDate.slice(0, 10) : '',
      amount: item.amount || '',
      bankName: item.bankName || '',
      description: item.description || '',
      status: item.status || 'PORTFOY',
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu çek/senet kaydını silmek istediğinize emin misiniz?')) return;
    try {
      await deleteManualCheque(id);
      await loadData();
      if (onDataChange) onDataChange();
    } catch (err: any) {
      alert(`Silme hatası: ${err.message}`);
    }
  };

  if (!customer) return null;

  return (
    <section className="cv2-panel active">
      <div className="cv2-action-bar">
        <button
          onClick={handleExportExcel}
          className="cv2-btn cv2-btn-accent"
          title="Listeyi Excel (.xlsx) olarak indir"
        >
          <svg className="cv2-ic"><use href="#i-download" /></svg>Excel
        </button>
        <button
          onClick={handlePrintPDF}
          className="cv2-btn cv2-btn-ghost"
          title="Resmi PDF Rapor / Yazdır"
        >
          <svg className="cv2-ic"><use href="#i-printer" /></svg>PDF / Yazdır
        </button>

        {!showAddForm && isAdmin && (
          <button onClick={() => setShowAddForm(true)} className="cv2-btn cv2-btn-ghost" style={{ borderColor: 'var(--cv2-blue-soft)', color: '#fff', background: 'rgba(79, 140, 255, 0.15)' }}>
            <svg className="cv2-ic"><use href="#i-plus" /></svg>Manuel Çek/Senet Ekle
          </button>
        )}

        <div className="cv2-balance-pill" style={{ background: 'linear-gradient(135deg, rgba(79, 140, 255, 0.10), rgba(79, 140, 255, 0.02))', borderColor: 'rgba(79, 140, 255, 0.25)' }}>
          <span className="lbl" style={{ color: 'var(--cv2-blue-soft)' }}>Evrak Sayısı</span>
          <span className="val num" style={{ color: '#fff' }}>
            {filteredAndSortedCheques.length} / {cheques.length}
          </span>
        </div>
      </div>

      <div className="cv2-stat-row" style={{ marginTop: 0, marginBottom: '16px' }}>
        <div className="cv2-stat-col">
          <div className="cv2-stat-eyebrow">Toplam Çek/Senet Riski</div>
          <div className="cv2-stat-fig num">{formatCurrency(totalChequeRisk)}</div>
        </div>
        <div className="cv2-stat-col">
          <div className="cv2-stat-eyebrow">Çek Portföyü ({cekList.length} Adet)</div>
          <div className="cv2-stat-fig num" style={{ color: 'var(--cv2-violet)' }}>{formatCurrency(cekSum)}</div>
        </div>
        <div className="cv2-stat-col">
          <div className="cv2-stat-eyebrow">Senet Portföyü ({senetList.length} Adet)</div>
          <div className="cv2-stat-fig num" style={{ color: 'var(--cv2-blue)' }}>{formatCurrency(senetSum)}</div>
        </div>
      </div>

      {overdueBreakdown.count > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--cv2-r-md)', border: '1px solid rgba(239,68,68,0.35)' }}>
          <span className="cv2-date-lbl" style={{ marginRight: '6px', color: 'var(--cv2-red, #ef4444)' }}>
            <svg className="cv2-ic"><use href="#i-alert" /></svg>Gecikmiş Vadeler ({overdueBreakdown.count}):
          </span>
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--cv2-red, #ef4444)' }} className="num">{formatCurrency(overdueBreakdown.sum)}</span>
        </div>
      )}

      {upcomingMonthBreakdown.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--cv2-r-md)', border: '1px solid var(--cv2-edge-soft)' }}>
          <span className="cv2-date-lbl" style={{ marginRight: '6px' }}><svg className="cv2-ic"><use href="#i-cal-range" /></svg>Gelecek Vade Dağılımı:</span>
          {upcomingMonthBreakdown.map(m => (
            <div key={m.key} style={{ background: 'rgba(255,255,255,0.04)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--cv2-ink-1)', fontWeight: 600 }}>{m.label} ({m.count}):</span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--cv2-ink-0)' }} className="num">{formatCurrency(m.sum)}</span>
            </div>
          ))}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleSubmit} className="glass-mini-card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
              {editingItem ? '✏️ Çek/Senet Düzenle' : '➕ Yeni Çek/Senet Kaydı'}
            </strong>
            <button type="button" onClick={resetForm} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>✕</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Evrak Tipi</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="form-input"
              >
                <option value="ÇEK">🎟️ ÇEK</option>
                <option value="SENET">📄 SENET</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Belge No</label>
              <input
                type="text"
                value={formData.docNo}
                onChange={(e) => setFormData({ ...formData, docNo: e.target.value })}
                placeholder="Örn: 1501507156"
                className="form-input"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Çek/Senet No</label>
              <input
                type="text"
                value={formData.subNo}
                onChange={(e) => setFormData({ ...formData, subNo: e.target.value })}
                placeholder="Örn: 253846"
                className="form-input"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tutar (TL) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="Örn: 50000"
                className="form-input"
                style={{ fontWeight: 'bold' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Alınış / İşlem Tarihi</label>
              <input
                type="date"
                value={formData.issueDate}
                onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                className="form-input"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Vade Tarihi *</label>
              <input
                type="date"
                required
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="form-input"
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
              <label className="form-label">Banka / Açıklama</label>
              <input
                type="text"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                placeholder="Banka adı veya açıklama..."
                className="form-input"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Durum</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="form-input"
              >
                <option value="PORTFOY">Portföyde (Riskte Kalır)</option>
                <option value="TAHSILDE">Tahsilde / Bankada (Riskte Kalır)</option>
                <option value="ODENDI">✅ Ödendi / Tahsil Edildi</option>
                <option value="IADE">⚠️ İade Edildi / Karşılıksız</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button
              type="button"
              onClick={resetForm}
              className="btn btn-outline"
            >
              İptal
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ background: '#ec4899', boxShadow: '0 4px 15px rgba(236, 72, 153, 0.4)' }}
            >
              {editingItem ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--cv2-ink-1)' }}>
          ⟳ Çek &amp; Senet kayıtları yükleniyor...
        </div>
      ) : cheques.length === 0 ? (
        <div className="cv2-empty-state">
          <div className="cv2-empty-icon"><svg className="cv2-ic"><use href="#i-check-c" /></svg></div>
          <div className="cv2-empty-title">Çek / Senet kaydı yok</div>
          <div className="cv2-empty-sub">Bu cari için kayıtlı çek veya senet bulunmamaktadır.</div>
        </div>
      ) : (
        <div className="cv2-table-wrap">
          <div className="cv2-table-scroll">
            <table>
              <thead>
                <tr>
                  <th onClick={() => requestSort('type')}>Tür <svg className="cv2-sort-ic"><use href="#i-chevrons" /></svg></th>
                  {customer?.customerId === 'GLOBAL' && (
                    <th onClick={() => requestSort('customerName')}>Cari Adı / Firma <svg className="cv2-sort-ic"><use href="#i-chevrons" /></svg></th>
                  )}
                  <th onClick={() => requestSort('docNo')}>Belge / Seri No <svg className="cv2-sort-ic"><use href="#i-chevrons" /></svg></th>
                  <th onClick={() => requestSort('issueDate')}>İşlem Tarihi <svg className="cv2-sort-ic"><use href="#i-chevrons" /></svg></th>
                  <th onClick={() => requestSort('dueDate')}>Vade Tarihi <svg className="cv2-sort-ic"><use href="#i-chevrons" /></svg></th>
                  <th>Vade Durumu</th>
                  <th onClick={() => requestSort('bankName')}>Banka / Açıklama <svg className="cv2-sort-ic"><use href="#i-chevrons" /></svg></th>
                  <th className="right" onClick={() => requestSort('amount')}>Tutar <svg className="cv2-sort-ic"><use href="#i-chevrons" /></svg></th>
                  <th onClick={() => requestSort('status')}>Durum <svg className="cv2-sort-ic"><use href="#i-chevrons" /></svg></th>
                  {isAdmin && <th className="center">İşlemler</th>}
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedCheques.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="cv2-tx-type">
                        <span className={`cv2-tx-dot ${item.type === 'SENET' ? 'neutral' : 'sale'}`} />
                        {item.type === 'SENET' ? 'SENET' : 'ÇEK'}
                      </span>
                    </td>
                    {customer?.customerId === 'GLOBAL' && (
                      <td style={{ fontSize: '12px', fontWeight: 600, color: 'var(--cv2-ink-0)' }}>
                        {item.customerName || item.customerId || '-'}
                      </td>
                    )}
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span className="cv2-doc-code">
                          {item.docNo || '-'}{item.subNo ? ` / ${item.subNo}` : ''}
                        </span>
                        {(item.docNo || item.subNo) && <CopyBadge textToCopy={item.docNo || item.subNo} size="small" />}
                      </div>
                    </td>
                    <td className="cv2-cell-date">{formatDate(item.issueDate)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--cv2-ink-0)' }}>{formatDate(item.dueDate)}</td>
                    <td>{getVadeBadge(item.dueDate, item.status)}</td>
                    <td style={{ fontSize: '12px', color: 'var(--cv2-ink-1)' }}>
                      {item.bankName || item.description || '-'}
                    </td>
                    <td className="right num" style={{ fontWeight: 800, color: 'var(--cv2-ink-0)' }}>
                      {formatCurrency(item.amount)}
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '3px 9px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          border: '1px solid transparent',
                          background: item.status === 'IADE' || item.status === 'KARSILIKSIZ' || item.status === 'CANCELLED' 
                            ? 'rgba(251,123,133,0.14)' 
                            : item.status === 'ODENDI' || item.status === 'TAHSIL_EDILDI'
                            ? 'rgba(61,220,154,0.14)'
                            : item.status === 'CREATED'
                            ? 'rgba(246,187,77,0.14)'
                            : 'rgba(79,140,255,0.14)',
                          color: item.status === 'IADE' || item.status === 'KARSILIKSIZ' || item.status === 'CANCELLED' 
                            ? 'var(--cv2-red)' 
                            : item.status === 'ODENDI' || item.status === 'TAHSIL_EDILDI'
                            ? 'var(--cv2-green)'
                            : item.status === 'CREATED'
                            ? 'var(--cv2-amber)'
                            : 'var(--cv2-blue-soft)',
                        }}
                      >
                        {item.status || 'PORTFOY'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="center" style={{ whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => handleEdit(item)}
                          style={{ background: 'none', border: 'none', color: 'var(--cv2-blue-soft)', cursor: 'pointer', marginRight: '8px' }}
                          title="Düzenle"
                        >
                          <svg className="cv2-ic"><use href="#i-edit" /></svg>
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--cv2-red)', cursor: 'pointer' }}
                          title="Sil"
                        >
                          <svg className="cv2-ic"><use href="#i-trash" /></svg>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
