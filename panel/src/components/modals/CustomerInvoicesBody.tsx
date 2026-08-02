import { useState, useEffect } from 'react';
import { getCustomerStatementSync } from '../../services/customerService';
import { formatDate, formatCurrency } from '../../utils/formatters';

interface CustomerInvoicesBodyProps {
  customer: any;
}

export default function CustomerInvoicesBody({ customer }: CustomerInvoicesBodyProps) {
  const [loading, setLoading] = useState(true);
  const [statement, setStatement] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    const data = getCustomerStatementSync(customer.customerId);
    // Simulate slight delay for UX
    setTimeout(() => {
      setStatement(data);
      setLoading(false);
    }, 400);
  }, [customer]);

  const hasInvoices = statement?.openInvoices && statement.openInvoices.length > 0;

  return (
    <section className="cv2-panel active">
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--cv2-ink-1)' }}>
          <span className="animate-spin" style={{ display: 'inline-block', marginRight: '8px' }}>⟳</span> Açık faturalar yükleniyor...
        </div>
      ) : !hasInvoices ? (
        <div className="cv2-empty-state">
          <div className="cv2-empty-icon"><svg className="cv2-ic"><use href="#i-check-c" /></svg></div>
          <div className="cv2-empty-title">Ödenmemiş açık fatura yok</div>
          <div className="cv2-empty-sub">Bu cari için henüz kapatılmamış bir fatura kaydı bulunmuyor. Yeni bir fatura kesildiğinde burada listelenecek.</div>
        </div>
      ) : (
        <div className="cv2-table-wrap">
          <div className="cv2-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Belge No</th>
                  <th>Tarih</th>
                  <th className="right">Orijinal</th>
                  <th className="right">Kalan</th>
                  <th className="center">Gün</th>
                </tr>
              </thead>
              <tbody>
                {statement.openInvoices.map((inv: any, idx: number) => {
                  const daysClass = inv.daysOverdue > 60 ? 'high' : inv.daysOverdue > 30 ? 'medium' : 'low';
                  return (
                    <tr key={inv.invoiceId || idx}>
                      <td><span className="cv2-doc-code">{inv.eDocumentNo || inv.invoiceId}</span></td>
                      <td className="cv2-cell-date">{formatDate(inv.invoiceDate)}</td>
                      <td className="right num" style={{ color: '#cbd5e1' }}>{formatCurrency(inv.originalAmount)}</td>
                      <td className="right num" style={{ fontWeight: 700, color: 'var(--cv2-ink-0)' }}>{formatCurrency(inv.openAmount)}</td>
                      <td className="center">
                        <span className={`cv2-days-badge ${daysClass}`}>{inv.daysOverdue}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="cv2-stat-row">
        <div className="cv2-stat-col">
          <div className="cv2-stat-eyebrow">Toplam Kalan Borç</div>
          <div className="cv2-stat-fig num">
            {formatCurrency(
              statement?.totalOpenAmount || 
              (statement?.openInvoices || []).reduce((sum: number, inv: any) => sum + (inv.openAmount || 0), 0)
            )}
          </div>
        </div>
        <div className="cv2-stat-col">
          <div className="cv2-stat-eyebrow">Ort. Vade</div>
          <div className="cv2-stat-fig warn num">
            {statement?.weightedAverageDays || statement?.aging?.averageVade || 0} gün
          </div>
        </div>
        <div className="cv2-stat-col">
          <div className="cv2-stat-eyebrow">Ort. Vade Tarihi</div>
          <div className="cv2-stat-fig">
            {statement?.averageDueDate 
              ? formatDate(statement.averageDueDate.toISOString ? statement.averageDueDate.toISOString() : statement.averageDueDate) 
              : (statement?.weightedAverageDays || statement?.aging?.averageVade)
                ? formatDate(new Date(Date.now() + (statement?.weightedAverageDays || statement?.aging?.averageVade || 0) * 86400000).toISOString())
                : '-'}
          </div>
        </div>
      </div>
    </section>
  );
}
