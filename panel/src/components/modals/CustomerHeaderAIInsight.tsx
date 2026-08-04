import React, { useMemo } from 'react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getCustomerPaymentTrendSync, getCustomerStatementSync } from '../../services/customerService';
import { MascotAvatar } from '../ai/MascotAvatar';

interface Props {
  customer: any;
  activeTab: string;
}

export default function CustomerHeaderAIInsight({ customer, activeTab }: Props) {
  const trend = useMemo(() => getCustomerPaymentTrendSync(customer.customerId), [customer.customerId]);
  const statement = useMemo(() => getCustomerStatementSync(customer.customerId), [customer.customerId]);
  
  const insight = useMemo(() => {
    const balance = customer.balance || 0;
    const avgDays = trend?.actualPaymentDays?.raw3M || 0;
    const rawOpenInvoices = statement?.openInvoices || [];
    // Only consider invoices with actual open amount > 0
    const openInvoices = rawOpenInvoices.filter((inv: any) => (inv.openAmount || inv.remainingAmount || 0) > 0);
    const transactions = statement?.transactions || [];

    if (activeTab === 'INVOICES') {
      if (openInvoices.length === 0) {
        if (balance > 0) {
          return `Müşterinin sisteme kayıtlı ödenmemiş açık faturası bulunmamaktadır. Ancak cari hesapta görünen ${formatCurrency(balance)} bakiye; geçmiş devir, çek/senet riski veya henüz faturalaşmamış işlemlerden (irsaliye vb.) kaynaklanıyor olabilir. Fatura bazlı bir vade riski bulunmamaktadır.`;
        }
        return "Müşterinin ödenmemiş açık faturası bulunmamaktadır. Tüm tahsilatlar düzenli olarak kapatılmıştır, hesapta vade riski sıfırdır. Yeni satış ve sevkiyat talepleri doğrudan onaylanabilir.";
      }
      
      const totalOpenAmount = openInvoices.reduce((sum: number, inv: any) => sum + (inv.openAmount || inv.remainingAmount || 0), 0);
      const overdueInvoices = openInvoices.filter((inv: any) => (inv.daysOverdue || inv.delayDays || 0) > 0);
      const oldestInvoiceDays = overdueInvoices.length > 0 
        ? Math.max(...overdueInvoices.map((inv: any) => (inv.daysOverdue || inv.delayDays || 0))) 
        : 0;

      let analysis = `Müşterinin toplam ${formatCurrency(totalOpenAmount)} tutarında ${openInvoices.length} adet açık faturası bulunmaktadır. `;
      
      if (overdueInvoices.length > 0) {
        analysis += `Bu faturalardan ${overdueInvoices.length} adedi vadesini geçmiş durumda (en eski gecikme: ${oldestInvoiceDays} gün). `;
        
        if (oldestInvoiceDays > 45) {
          analysis += `Ortalama ödeme hızı ${avgDays} gün olan müşteri için mevcut gecikme risk sinyali oluşturmaktadır. Sevkiyatların kontrollü yapılması ve tahsilat aksiyonu alınması tavsiye edilir.`;
        } else if (oldestInvoiceDays > 15) {
          analysis += `Gecikmeler makul sınırları aşmaya başlamış. Cari hesap mutabakatı yapılarak eski vadeli faturalar için kısmi ödeme takibi yapılması yeterli olacaktır.`;
        } else {
          analysis += `Vade aşımları kısa süreli olup (${oldestInvoiceDays} gün), müşterinin ortalama ${avgDays > 0 ? avgDays : 'genel'} günlük ödeme döngüsüyle uyumludur. Yakın vade riski görünmemektedir.`;
        }
      } else {
        analysis += `Açık faturaların tamamının vadesi henüz gelmemiştir. Nakit akışında riskli bir durum öngörülmemektedir.`;
      }
      return analysis;
    } 
    
    if (activeTab === 'STATEMENT') {
       if (transactions.length === 0) {
         return "Ekstrede listelenecek geçmiş hareket bulunmuyor. Yeni kazanılmış bir müşteri veya işlem hacmi henüz oluşmamış bir cari olabilir.";
       }
       
       const salesTxs = transactions.filter((t: any) => t.type === 'SATIŞ' || (t.debit && t.debit > 0));
       const collTxs = transactions.filter((t: any) => t.type === 'TAHSİLAT' || (t.credit && t.credit > 0));
       
       const totalDebit = salesTxs.reduce((sum: number, t: any) => sum + (t.debit || 0), 0);
       const totalCredit = collTxs.reduce((sum: number, t: any) => sum + (t.credit || 0), 0);
       
       const lastCollection = collTxs.length > 0 ? collTxs[0] : null;
       const lastCollDateFormatted = lastCollection?.date ? formatDate(lastCollection.date) : '';

       let analysis = `Tüm ekstre geçmişi incelendiğinde; müşteri toplamda ${salesTxs.length} kez siparişle ${formatCurrency(totalDebit)} işlem hacmi yaratmış ve buna karşılık ${collTxs.length} ayrı işlemde ${formatCurrency(totalCredit)} ödeme yapmıştır. `;
       
       if (balance > 30000) {
         const expectedCollection = balance * 0.4;
         analysis += `Son tahsilat işlemi ${lastCollDateFormatted || 'bulunmayan'} müşterinin güncel ${formatCurrency(balance)} net borç bakiyesi yüksektir. ${avgDays > 0 ? `Tarihsel ödeme hızı (${avgDays} gün) göz önüne alınarak,` : ''} Gelecek ayki nakit akışınız için en az ${formatCurrency(expectedCollection)} tutarında bir ara tahsilat planlanması operasyonel sağlığınızı artıracaktır.`;
       } else if (balance <= 0 && (customer.cekSenetRisk || 0) === 0) {
         analysis += `Müşterinin cari ekstresi şu an tamamen dengelenmiş durumdadır. Satış - tahsilat döngüsü son derece istikrarlı. Gelecek dönemde ciro artırıcı kampanya sunumları için portföyünüzdeki en risksiz carilerden biridir.`;
       } else {
         analysis += `Ekstredeki borç/alacak dengesi sağlıklı ve istikrarlı bir şekilde dönmektedir. Mevcut işlem hacmi değerlendirildiğinde, önümüzdeki döngüde bir tahsilat problemi öngörülmemektedir.`;
       }
       return analysis;
    }
    
    return null;
  }, [customer, activeTab, trend, statement]);

  if (!insight) return null;

  return (
    <div className="cv2-hero-ai-insight">
      <div className="cv2-ai-insight-mascot">
        <MascotAvatar size="small" isTyping={false} />
        <span className="cv2-ai-title">Günlü'nün Analizi</span>
      </div>
      <div className="cv2-ai-insight-text">
        <p>{insight}</p>
      </div>
    </div>
  );
}
