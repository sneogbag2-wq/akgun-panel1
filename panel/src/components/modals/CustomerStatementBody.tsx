import React, { useState, useEffect, useMemo } from 'react';
import { formatCurrency, formatDate, getCustomerStatement, setDashboardActiveFilters } from '../../services/customerService';
import { exportToCorporateExcel, printReportHTML } from '../../utils/exportUtils';
import CopyBadge from '../common/CopyBadge';

interface Props {
  customer: any;
}

export default function CustomerStatementBody({ customer }: Props) {
  const [statementData, setStatementData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'asc' });

  const effectiveStart = customer?.startDate || '';
  const effectiveEnd = customer?.endDate || '';

  const [datePreset, setDatePreset] = useState(effectiveStart || effectiveEnd ? 'CUSTOM' : 'ALL');
  const [startDate, setStartDate] = useState(effectiveStart);
  const [endDate, setEndDate] = useState(effectiveEnd);

  useEffect(() => {
    if (customer) {
      setDashboardActiveFilters({
        modalCustomer: customer,
        modalStartDate: startDate,
        modalEndDate: endDate
      });
    }
    return () => {
      setDashboardActiveFilters({
        modalCustomer: null,
        modalStartDate: '',
        modalEndDate: ''
      });
    };
  }, [customer, startDate, endDate]);

  useEffect(() => {
    if (customer) {
      const s = customer.startDate || '';
      const e = customer.endDate || '';
      setStartDate(s);
      setEndDate(e);
      setDatePreset(s || e ? 'CUSTOM' : 'ALL');

      setLoading(true);
      getCustomerStatement(customer.customerId).then(data => {
        setStatementData(data);
        setLoading(false);
      }).catch(err => {
        console.error('Ekstre yükleme hatası:', err);
        setLoading(false);
      });
    }
  }, [customer]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const isSorted = (key: string) => sortConfig.key === key;

  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();

    if (preset === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'LAST_3M') {
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10);
      setStartDate(threeMonthsAgo);
      setEndDate(now.toISOString().slice(0, 10));
    } else if (preset === 'YEAR_2026') {
      setStartDate('2026-01-01');
      setEndDate('2026-12-31');
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const filteredAndSortedTransactions = useMemo(() => {
    if (!statementData || !statementData.transactions) return [];
    let list = [...statementData.transactions];

    if (filterType !== 'ALL') {
      list = list.filter(t => t.type.toUpperCase().includes(filterType));
    }

    if (filterText) {
      const q = filterText.toLowerCase();
      list = list.filter(t => 
        (t.docNo || '').toLowerCase().includes(q) ||
        (t.type || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }

    if (startDate) {
      list = list.filter(t => String(t.date || '').slice(0, 10) >= startDate);
    }
    if (endDate) {
      list = list.filter(t => String(t.date || '').slice(0, 10) <= endDate);
    }

    list.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'date') {
        aVal = new Date(aVal || 0).getTime();
        bVal = new Date(bVal || 0).getTime();
        
        if (aVal === bVal && a._originalIndex !== undefined && b._originalIndex !== undefined) {
          return sortConfig.direction === 'asc' 
            ? a._originalIndex - b._originalIndex 
            : b._originalIndex - a._originalIndex;
        }
      } else if (['debit', 'credit', 'balance'].includes(sortConfig.key)) {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [statementData, filterText, filterType, startDate, endDate, sortConfig]);

  const handleExportExcel = () => {
    if (!filteredAndSortedTransactions.length) return;
    exportToCorporateExcel({
      title: 'CARİ HESAP EKSTRESİ',
      customer,
      subtitle: `Toplam ${filteredAndSortedTransactions.length} Hareket`,
      fileName: `Cari_Ekstre_${customer?.customerId}_${Date.now()}.xlsx`,
      sheetName: 'Ekstre',
      columns: [
        { header: 'İşlem Tarihi', excelValue: (r: any) => formatDate(r.date) },
        { header: 'İşlem Türü', excelValue: (r: any) => r.type },
        { header: 'Açıklama', excelValue: (r: any) => r.description || '' },
        { header: 'Belge / Fatura No', excelValue: (r: any) => r.docNo || '' },
        { header: 'Borç (TL)', key: 'debit', isNumeric: true, excelValue: (r: any) => r.debit || 0 },
        { header: 'Alacak (TL)', key: 'credit', isNumeric: true, excelValue: (r: any) => r.credit || 0 },
        { header: 'Küm. Bakiye (TL)', key: 'balance', isNumeric: true, excelValue: (r: any) => r.balance || 0 }
      ],
      rows: filteredAndSortedTransactions
    });
  };

  const handlePrintPDF = () => {
    if (!filteredAndSortedTransactions.length) return;
    printReportHTML({
      title: 'CARİ HESAP EKSTRESİ',
      customer,
      subtitle: `Toplam ${filteredAndSortedTransactions.length} Hareket`,
      summaryBoxes: [
        { label: 'GÜNCEL BAKİYE', value: `${formatCurrency(Math.abs(statementData?.balance || 0))} ${statementData?.balance > 0 ? '(B)' : '(A)'}`, color: statementData?.balance > 0 ? '#dc2626' : '#059669' },
        { label: 'TOPLAM SATIŞ', value: formatCurrency(statementData?.transactions?.filter((t: any) => t.debit > 0).reduce((s: number, t: any) => s + t.debit, 0) || 0), color: '#2563eb' },
        { label: 'TOPLAM TAHSİLAT', value: formatCurrency(statementData?.transactions?.filter((t: any) => t.credit > 0).reduce((s: number, t: any) => s + t.credit, 0) || 0), color: '#059669' }
      ],
      columns: [
        { header: 'İşlem Tarihi', render: (r: any) => formatDate(r.date) },
        { header: 'İşlem Türü', render: (r: any) => r.type },
        { header: 'Belge No', render: (r: any) => r.docNo },
        { header: 'Açıklama', render: (r: any) => r.description },
        { header: 'Borç (TL)', align: 'right', render: (r: any) => r.debit > 0 ? formatCurrency(r.debit) : '-' },
        { header: 'Alacak (TL)', align: 'right', render: (r: any) => r.credit > 0 ? formatCurrency(r.credit) : '-' },
        { header: 'Bakiye (TL)', align: 'right', render: (r: any) => `${formatCurrency(Math.abs(r.balance))} ${r.balance > 0 ? '(B)' : '(A)'}` }
      ],
      rows: filteredAndSortedTransactions
    });
  };

  if (!customer) return null;

  return (
    <section className="cv2-panel active">
      <div className="cv2-action-bar">
        <button onClick={handleExportExcel} className="cv2-btn cv2-btn-accent" title="Listeyi Excel (.xlsx) olarak indir">
          <svg className="cv2-ic"><use href="#i-download" /></svg>Excel
        </button>
        <button onClick={handlePrintPDF} className="cv2-btn cv2-btn-ghost" title="Resmi PDF Ekstre / Yazdır">
          <svg className="cv2-ic"><use href="#i-printer" /></svg>PDF / Yazdır
        </button>

        {statementData && (
          <div className="cv2-balance-pill">
            <span className="lbl">Güncel Bakiye</span>
            <span className="val num">
              {formatCurrency(Math.abs(statementData.balance))} {statementData.balance > 0 ? '(B)' : (statementData.balance < 0 ? '(A)' : '')}
            </span>
          </div>
        )}
      </div>

      <div className="cv2-toolbar">
        <div className="cv2-toolbar-row">
          <div className="cv2-search-field">
            <svg className="cv2-ic"><use href="#i-search" /></svg>
            <input
              type="text"
              placeholder="Fatura no, işlem türü veya açıklama ara…"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
            />
          </div>
          <select
            className="cv2-mini-select"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="ALL">Tüm İşlem Türleri</option>
            <option value="SATIŞ">Satış Faturaları</option>
            <option value="TAHSİLAT">Tahsilatlar</option>
            <option value="ALACAK DEKONTU">Alacak Dekontları / İadeler</option>
          </select>
        </div>

        <div className="cv2-toolbar-row cv2-date-strip">
          <span className="cv2-date-lbl"><svg className="cv2-ic"><use href="#i-calendar" /></svg>Tarih süzgeci</span>

          {[
            { id: 'ALL', label: 'Tüm Zamanlar' },
            { id: 'THIS_MONTH', label: 'Bu Ay' },
            { id: 'LAST_3M', label: 'Son 3 Ay' },
            { id: 'YEAR_2026', label: '2026 Yılı' },
          ].map(preset => (
            <span
              key={preset.id}
              onClick={() => handlePresetChange(preset.id)}
              className={`cv2-chip ${datePreset === preset.id ? 'active' : ''}`}
            >
              {preset.label}
            </span>
          ))}

          <div className="cv2-date-inputs">
            <input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setDatePreset('CUSTOM'); }}
            />
            <span>—</span>
            <input
              type="date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setDatePreset('CUSTOM'); }}
            />
          </div>
        </div>

        {statementData && (
          <div className="cv2-result-count">
            <svg className="cv2-ic"><use href="#i-chart" /></svg>
            Toplam {filteredAndSortedTransactions.length} Hareket
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--cv2-ink-1)', fontWeight: 600 }}>
          ⟳ Hesap ekstresi yükleniyor...
        </div>
      ) : !statementData || !statementData.transactions || statementData.transactions.length === 0 ? (
        <div className="cv2-empty-state">
          <div className="cv2-empty-icon"><svg className="cv2-ic"><use href="#i-check-c" /></svg></div>
          <div className="cv2-empty-title">Hesap hareketi bulunmuyor</div>
          <div className="cv2-empty-sub">Bu müşteriye ait hesap hareketi bulunmamaktadır.</div>
        </div>
      ) : (
        <div className="cv2-table-wrap">
          <div className="cv2-table-scroll">
            <table>
              <thead>
                <tr>
                  <th className={isSorted('date') ? 'sorted' : ''} onClick={() => requestSort('date')}>İşlem Tarihi <svg className="cv2-sort-ic"><use href="#i-chevrons" /></svg></th>
                  <th className={isSorted('type') ? 'sorted' : ''} onClick={() => requestSort('type')}>İşlem Türü <svg className="cv2-sort-ic"><use href="#i-chevrons" /></svg></th>
                  <th className={isSorted('docNo') ? 'sorted' : ''} onClick={() => requestSort('docNo')}>Belge / Fatura No <svg className="cv2-sort-ic"><use href="#i-chevrons" /></svg></th>
                  <th className={`right ${isSorted('debit') ? 'sorted' : ''}`} onClick={() => requestSort('debit')}>Borç (₺) <svg className="cv2-sort-ic"><use href="#i-chevrons" /></svg></th>
                  <th className={`right ${isSorted('credit') ? 'sorted' : ''}`} onClick={() => requestSort('credit')}>Alacak (₺) <svg className="cv2-sort-ic"><use href="#i-chevrons" /></svg></th>
                  <th className={`right ${isSorted('balance') ? 'sorted' : ''}`} onClick={() => requestSort('balance')}>Bakiye (₺) <svg className="cv2-sort-ic"><use href="#i-chevrons" /></svg></th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedTransactions.map((tr: any, idx: number) => {
                  const isSales = tr.type.includes('SATIŞ');
                  const isCollection = tr.type.includes('TAHSİLAT');
                  const dotClass = isSales ? 'sale' : (isCollection ? 'collect' : 'neutral');

                  return (
                    <tr key={`${tr.id}-${idx}`}>
                      <td className="cv2-cell-date">{formatDate(tr.date)}</td>
                      <td>
                        <div className="cv2-tx">
                          <span className="cv2-tx-type"><span className={`cv2-tx-dot ${dotClass}`} />{tr.type}</span>
                          {tr.description && <span className="cv2-tx-desc">{tr.description}</span>}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span className="cv2-doc-code">{tr.docNo}</span>
                          {tr.docNo && <CopyBadge textToCopy={tr.docNo} size="small" />}
                        </div>
                      </td>
                      <td className="right num cv2-amt-debit" style={!(tr.debit > 0) ? { color: 'var(--cv2-ink-2)', fontWeight: 400 } : undefined}>
                        {tr.debit > 0 ? formatCurrency(tr.debit) : '-'}
                      </td>
                      <td className="right num cv2-amt-credit" style={!(tr.credit > 0) ? { color: 'var(--cv2-ink-2)', fontWeight: 400 } : undefined}>
                        {tr.credit > 0 ? formatCurrency(tr.credit) : '-'}
                      </td>
                      <td className="right num cv2-amt-balance">
                        {formatCurrency(Math.abs(tr.balance))} <small>{tr.balance > 0 ? '(B)' : (tr.balance < 0 ? '(A)' : '')}</small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
