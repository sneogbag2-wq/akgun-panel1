/**
 * AI Tool Declarations (Gemini function-calling şeması)
 *
 * P2-3 (kısmen) düzeltmesi: bu dizi önceden aiTools.ts içinde (~satır 134-816, 683
 * satır) tanımlıydı — dosyanın 2093+ satırının en büyük tek bloğuydu ve raporun kendi
 * P2-3 bulgusunun ('Devasa tek dosyalar... aiTools.ts'de 49 aracın execute/açıklama
 * tanımlarını her araç için ayrı dosyaya taşıyıp bir index.ts ile toplayın') doğrudan
 * konusuydu. Bu tur, tam 'her araç kendi dosyasında' hedefine gitmedi (49 ayrı dosya
 * oluşturmak, çok daha büyük ve gözden geçirilmesi zor bir değişiklik olurdu); bunun
 * yerine en büyük tek pürüzü — tüm araçların şema tanımını taşıyan bu dizi — aynı
 * içerikle, davranış değişikliği olmadan buraya taşıdı.
 *
 * NOT: Bu dizi çoğunlukla saf şema (name/description/parameters) olsa da, 3 giriş
 * (getSalesFkns, getProductPenetration, sellout ile ilgili bir üçüncüsü) kendi
 * 'execute' fonksiyonunu doğrudan burada barındırıyor (asıl yürütme çoğu araç için
 * aiTools.ts > executeAiTool() switch'inde). Bu execute fonksiyonlarının kullandığı
 * calculateFknsForRep/calculateProductPenetration import'ları da bu dosyaya taşındı;
 * geri kalanı (selloutCalculations) zaten kendi dinamik import'unu kullanıyordu,
 * dokunulmadı.
 */

import { calculateFknsForRep, calculateProductPenetration } from '../calculations/fknsCalculations';

export const aiToolDeclarations = [
  {
    name: 'getFinancialConcentration',
    description: 'Herfindahl-Hirschman Index (HHI) ile portföy müşteri/sektör yoğunlaşma riskini getirir. HHI bir yoğunlaşma ölçüsüdür, kayıp değildir.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'getAgingMigrationMatrix',
    description: 'Vade dilimleri arasındaki geçiş matrisini (Aging Migration) getirir. Migration bir tahsilat başarısı değil, vade devridir.',
    parameters: {
      type: 'OBJECT',
      properties: {
        period: { type: 'STRING', description: 'YYYY-MM formatında dönem' }
      },
      required: []
    }
  },
  {
    name: 'getInvoiceVintageAnalysis',
    description: 'Fatura kesim dönemlerine göre tahsilat kohort/vintage analizini getirir. Genç faturalar başarısız sayılamaz.',
    parameters: {
      type: 'OBJECT',
      properties: {
        cohortMonth: { type: 'STRING', description: 'YYYY-MM formatında fatura ayı' }
      },
      required: []
    }
  },
  {
    name: 'getPaymentSurvival',
    description: 'Sansürlü (right-censored) tahsilat hayatta kalma eğrisini getirir. Kesin ödeme tarihi tahmini değil, istatistiksel çıkarımdır (INFERENCE).',
    parameters: {
      type: 'OBJECT',
      properties: {
        customerId: { type: 'STRING' }
      },
      required: []
    }
  },
  {
    name: 'getAgedBurdenFlow',
    description: '29+ gün vadesi geçmiş alacak yükü akışını ve köprü sürücülerini (bridge drivers) getirir.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'getFinancialBehaviorSegment',
    description: 'Müşterinin finansal ödeme/risk davranış segmentini getirir. Ana/Master müşteri segmentini değiştirmez.',
    parameters: {
      type: 'OBJECT',
      properties: {
        customerId: { type: 'STRING' }
      },
      required: []
    }
  },
  {
    name: 'getPeerBenchmark',
    description: 'Müşteriyi benzer ölçek/sektör grubundaki (peer cohort) diğer müşterilerle kıyaslar. En az 10 müşterilik anonim küme kullanılır.',
    parameters: {
      type: 'OBJECT',
      properties: {
        customerId: { type: 'STRING' }
      },
      required: []
    }
  },
  {
    name: 'getAiFocusAnalysis',
    description: 'Seçili bir müşteri, sipariş veya genel durum için finansal/operasyonel metrikleri (limit, tahsilat, sevkiyat, risk vb.) toplayıp, en kritik 3 bulguyu ve eylem önerisini önem sırasına göre birleştirilmiş (digest) bir odak analizi olarak getirir.',
    parameters: {
      type: 'OBJECT',
      properties: {
        entityId: { type: 'STRING', description: 'Müşteri ID, Sipariş ID vb.' },
        entityType: { type: 'STRING', description: 'CUSTOMER, ORDER, PORTFOLIO vb.' }
      },
      required: ['entityId', 'entityType']
    }
  },
  {
    name: 'getCustomerFinancialHealth',
    description: 'Bir müşterinin finansal sağlık skorunu, bileşenlerini ve genel risk durumunu mutabık bir sonuç olarak getirir. AI kendi başına sağlık puanı üretmemelidir.',
    parameters: {
      type: 'OBJECT',
      properties: {
        customerId: { type: 'STRING' }
      },
      required: ['customerId']
    }
  },
  {
    name: 'explainFinancialHealthComponent',
    description: 'Müşteri sağlık skorundaki belirli bir bileşenin (örneğin tahsilat performansı) neden yüksek veya düşük olduğunu detaylarıyla (drill-down) açıklar.',
    parameters: {
      type: 'OBJECT',
      properties: {
        customerId: { type: 'STRING' },
        component: { type: 'STRING' }
      },
      required: ['customerId', 'component']
    }
  },
  {
    name: 'getInternalLimitRecommendation',
    description: 'Müşteri için önerilen iç kredi limitini ve etkin limiti (governance limit) getirir. Bu değer sabittir, AI tarafından hesaplanmamalıdır.',
    parameters: {
      type: 'OBJECT',
      properties: {
        customerId: { type: 'STRING' }
      },
      required: ['customerId']
    }
  },
  {
    name: 'explainInternalLimitChange',
    description: 'Kredi limit önerisindeki değişikliğin nedenlerini, kullanım oranını (usage/headroom) ve geçerlilik süresini (validity) açıklar.',
    parameters: {
      type: 'OBJECT',
      properties: {
        customerId: { type: 'STRING' }
      },
      required: ['customerId']
    }
  },
  {
    name: 'getRepresentativeFinancialPerformance',
    description: 'Bir satış temsilcisinin (plasiyer) portföyü için oluşturulmuş finansal tahsilat karnesini (CEI, kapanma hızı, limit disiplini) getirir.',
    parameters: {
      type: 'OBJECT',
      properties: {
        representativeId: { type: 'STRING' }
      },
      required: ['representativeId']
    }
  },
  {
    name: 'getSsmFinancialPerformance',
    description: 'Bölge (SSM) düzeyindeki birleştirilmiş finansal karneyi getirir. Temsilci ortalaması değildir, bölgeye özel performans verisidir.',
    parameters: {
      type: 'OBJECT',
      properties: {
        ssmId: { type: 'STRING' }
      },
      required: ['ssmId']
    }
  },
  {
    name: 'getFinancialPosition',
    description: 'Bir veya birden fazla müşterinin Cari Bakiyesini, Açık Çek/Senet Riskini ve Toplam Riskini mutabık kalarak getirir. LLM asla hesaplama yapmamalıdır.',
    parameters: {
      type: 'OBJECT',
      properties: {
        customerId: { type: 'STRING' }
      },
      required: []
    }
  },
  {
    name: 'getFinancialReconciliation',
    description: 'İki dönem veya iki kaynak (ERP vs Manuel) arasındaki bakiye farklarını ve mutabakat sonuçlarını getirir.',
    parameters: {
      type: 'OBJECT',
      properties: {
        customerId: { type: 'STRING' }
      },
      required: []
    }
  },
  {
    name: 'getAccountingDso',
    description: 'Günlük EOD (End of Day) açık alacak ve satış verisine dayanarak kesin (immutable) DSO (Days Sales Outstanding) tahsilat süresini hesaplanmış olarak getirir.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'getAgedReceivableCei',
    description: '29+ gün vadesi geçmiş (aged) havuzun ne kadarının tahsil edildiğini gösteren CEI (Collection Effectiveness Index) oranını getirir.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'getPaymentSpeed',
    description: 'Son 3, 6 veya 12 aylık (3/6/12) ekonomik veya sadece nakit (cash-only) ödeme hızını getirir.',
    parameters: {
      type: 'OBJECT',
      properties: {
        months: { type: 'NUMBER', description: '3, 6 veya 12' },
        cashOnly: { type: 'BOOLEAN', description: 'İade/hizmet dahil edilmeyecekse true' }
      },
      required: ['months']
    }
  },
  {
    name: 'explainFinancialMetric',
    description: 'DSO, CEI, Ödeme Hızı gibi spesifik bir finansal metriğin arka planındaki mutabakatı (pay/payda, kapsam) kelimelerle açıklamak için detayları (envelope) getirir.',
    parameters: {
      type: 'OBJECT',
      properties: {
        metricId: { type: 'STRING' }
      },
      required: ['metricId']
    }
  },
  {
    name: 'draftManualTransaction',
    description: 'Bir finansal işlem (ekleme, düzeltme, silme) talebini hemen çalıştırmadan önce sisteme taslak (draft) olarak kaydeder.',
    parameters: {
      type: 'OBJECT',
      properties: {
        transactionType: { type: 'STRING', description: 'Örn: NAKIT_TAHSILAT, SATIS_FATURASI, vb.' },
        amount: { type: 'NUMBER' },
        customerId: { type: 'STRING' }
      },
      required: ['transactionType', 'amount', 'customerId']
    }
  },
  {
    name: 'previewManualTransaction',
    description: 'Taslak (draft) halindeki veya talep edilen bir finansal işlemin uygulanması durumunda FIFO, yaşlandırma, bakiye ve KPI raporlarında yaratacağı değişikliği (Before/After) ve riskleri hesaplar. Onaydan önce ZORUNLU aşamadır.',
    parameters: {
      type: 'OBJECT',
      properties: {
        draftId: { type: 'STRING' }
      },
      required: ['draftId']
    }
  },
  {
    name: 'commitManualTransaction',
    description: 'Önizlemesi (preview) tamamlanmış ve kullanıcıdan kesin onayı (confirmation) alınmış işlemi veri tabanına kalıcı olarak işler. Önizleme yapılmadan ÇAĞRILAMAZ.',
    parameters: {
      type: 'OBJECT',
      properties: {
        previewId: { type: 'STRING' },
        previewHash: { type: 'STRING', description: 'Önizleme anında oluşturulan güvenlik hashi.' }
      },
      required: ['previewId', 'previewHash']
    }
  },
  {
    name: 'listManualSourceConflicts',
    description: 'Kullanıcının daha önce girdiği manuel veriler ile ana ERP (kaynak) sistemi senkronize olduğunda ortaya çıkan çatışmaları (conflict) listeler.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'getSelloutHistoricalComparison',
    description: 'İki spesifik dönem (ör: Mart 2025 ile Mart 2026) arasındaki sellout (satış) miktar/litre değişimlerini, delta yüzdelerini ve kanal paylarındaki farkları kıyaslar.',
    parameters: {
      type: 'OBJECT',
      properties: {
        basePeriod: { type: 'STRING', description: 'Kıyaslamaya baz alınacak ilk dönem (ör: 2025-03)' },
        comparePeriod: { type: 'STRING', description: 'Kıyaslanacak olan ikinci dönem (ör: 2026-03)' }
      },
      required: ['basePeriod', 'comparePeriod']
    }
  },
  {
    name: 'getSelloutMonthlyReport',
    description: 'Tek bir aya (veya aralığa) ait genel sellout performansını, açık/kapalı kanal kKPI\'larını özetler.',
    parameters: {
      type: 'OBJECT',
      properties: {
        period: { type: 'STRING', description: 'İncelenecek dönem (ör: 2026-03)' }
      },
      required: ['period']
    }
  },
  {
    name: 'getSelloutComparisonContributions',
    description: 'Kıyaslanan iki dönem arasında satışı (sellout) en çok artıran veya düşüren müşteri, temsilci veya ürünleri (top katkı) analiz eder.',
    parameters: {
      type: 'OBJECT',
      properties: {
        basePeriod: { type: 'STRING' },
        comparePeriod: { type: 'STRING' }
      },
      required: ['basePeriod', 'comparePeriod']
    }
  },
  {
    name: 'createSelloutReportPack',
    description: 'Sellout tarihi analizi sonuçlarının PDF ve Excel formatlarında oluşturulması (Report Pack) için manifest tetikler.',
    parameters: {
      type: 'OBJECT',
      properties: {
        reportName: { type: 'STRING', description: 'Oluşturulacak raporun başlığı.' }
      },
      required: ['reportName']
    }
  },
  {
    name: 'getTodaysDispatchOrders',
    description: 'Bugün dağıtıma/araca çıkacak olan operasyonel siparişleri listeler. "Bugün dağıtıma ne çıkacak?", "sevkiyat durumu nedir?" gibi lojistik sorularında kullanılır.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'getDeliveredInvoiceControls',
    description: 'Malı teslim edilmiş ancak henüz kapanmamış (tahsilat eşleşmesi beklenen veya hatalı olan) fatura kontrol listesini getirir.',
    parameters: {
      type: 'OBJECT',
      properties: {
        customerId: {
          type: 'STRING',
          description: 'Belirli bir müşteriye ait fatura kontrollerini filtrelemek için opsiyonel ID.'
        }
      },
      required: []
    }
  },
  {
    name: 'explainInvoiceControlAlert',
    description: 'Fatura kontrol listesindeki spesifik bir belgedeki (fatura) uyumsuzluğu, FIFO veya peşin eşleşme risklerini açıklar.',
    parameters: {
      type: 'OBJECT',
      properties: {
        documentId: {
          type: 'STRING',
          description: 'İncelenecek faturanın belge numarası veya kontrol ID\'si.'
        }
      },
      required: ['documentId']
    }
  },
  {
    name: 'checkWarehouseStock',
    description: 'Depomuzdaki, anlık satılabilir fiziki stok (malzeme/ürün) miktarını sorgular. Kullanıcı "stokta ne kadar X var", "depoda ne kadar kaldı" gibi kendi stoğumuzu sorarsa kullanın.',
    parameters: {
      type: 'OBJECT',
      properties: {
        productName: {
          type: 'STRING',
          description: 'Sorgulanan malzeme veya ürünün adı.'
        }
      },
      required: ['productName']
    }
  },
  {
    name: 'checkCustomerCommercialStock',
    description: 'Müşteriye sevk edilmiş, müşterinin elinde/emanetinde bulunan ticari konsinye stoğu sorgular. Kullanıcı "A müşterisinde ne kadar malımız var", "emanetteki stok nedir" diye sorarsa kullanın.',
    parameters: {
      type: 'OBJECT',
      properties: {
        customerId: {
          type: 'STRING',
          description: 'Emanet stoğu sorgulanacak müşterinin ID veya cari kodu.'
        },
        productName: {
          type: 'STRING',
          description: 'İsteğe bağlı belirli bir ürün adı (boşsa müşterideki tüm emanetler gelir).'
        }
      },
      required: ['customerId']
    }
  },
  {
    name: 'generateReportArtifact',
    description: 'Generates formal report files (e.g. PDF, Excel) for a given topic and period, placing them in a download queue. Use this when the user asks to "prepare a report", "compare periods", or "give me an Excel/PDF".',
    parameters: {
      type: 'OBJECT',
      properties: {
        reportKey: {
          type: 'STRING',
          description: 'Type of report. E.g., FINANCIAL_SUMMARY, SALES_PERFORMANCE, AGING_REPORT, CASH_FORECAST, PERIOD_COMPARISON'
        },
        formats: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'Requested formats, e.g., ["PDF", "XLSX"]'
        },
        primaryPeriod: {
          type: 'STRING',
          description: 'The primary period to report on (e.g., "2023-10" or "Q3 2023")'
        },
        comparisonPeriod: {
          type: 'STRING',
          description: 'The period to compare against, if applicable (e.g., "2023-09")'
        },
        filters: {
          type: 'OBJECT',
          description: 'Any applied filters, such as customerId or representativeId'
        }
      },
      required: ['reportKey', 'formats']
    }
  },
  {
    name: 'discoverMoreTools',
    description: 'Use only when the currently offered tools cannot answer the request. It expands the tool catalog for this same user request; provide a concise Turkish topic describing the missing capability.',
    parameters: {
      type: 'OBJECT',
      properties: {
        topic: {
          type: 'STRING',
          description: 'The missing reporting or operational capability, in Turkish.'
        }
      },
      required: ['topic']
    }
  },
  {
    name: 'getGlobalFinancialSummary',
    description: 'Get global financial summary including total sales, collections, credit notes, and net receivables balance.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'getCurrentStatus',
    description: 'Get current operational status metrics: open invoice count, today collections total, weighted portfolio average payment terms.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'searchCustomers',
    description: 'Search for customers by name, customer ID (5000XXXXXX), or sign name.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Search query (customer ID, name, or business title)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'getCustomerDetails',
    description: 'Get detailed information and balance for a specific customer by customerId.',
    parameters: {
      type: 'OBJECT',
      properties: {
        customerId: {
          type: 'STRING',
          description: 'Customer ID (e.g. 5000123456)'
        }
      },
      required: ['customerId']
    }
  },
  {
    name: 'getCustomerStatement',
    description: 'Get detailed account statement ledger (ekstre) and FIFO aging for a specific customer by customerId.',
    parameters: {
      type: 'OBJECT',
      properties: {
        customerId: {
          type: 'STRING',
          description: 'Customer ID (e.g. 5000123456)'
        }
      },
      required: ['customerId']
    }
  },
  {
    name: 'queryTransactions',
    description: 'Query specific customer transactions (collections, sales invoices, credit notes) or open unpaid invoices (ACIK_FATURA) by customer name/code, transaction type, and date ordering. ALWAYS use this for questions like "X customer\'s last collection", "open invoices of Y", "average payment term days".',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Customer name, customer code (5000XXXXXX), or business sign name (e.g. "darwin", "777", "akin market")'
        },
        transactionType: {
          type: 'STRING',
          description: 'Filter transaction type: "ACIK_FATURA" (unpaid open invoices), "TAHSILAT" (collections), "SATIS" (sales invoices), "DEKONT" (credit notes), or "ALL"'
        },
        sortBy: {
          type: 'STRING',
          description: 'Sorting order: "LATEST" (newest date first, default for "last/en son"), "OLDEST" (oldest first), "HIGHEST_AMOUNT" (largest amount first)'
        },
        limit: {
          type: 'NUMBER',
          description: 'Number of records to return (default: 10). Set this to a high number (e.g., 50 or 100) if you need to calculate averages over long periods like 3-6 months.'
        }
      },
      required: []
    }
  },
  {
    name: 'getTopDebtors',
    description: 'Get the top N customers with highest debt (positive balance). Use this for "en borçlu müşteri", "en yüksek borcu olanlar", "alacak riski".',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: {
          type: 'NUMBER',
          description: 'Number of top debtors to return (default: 10)'
        }
      },
      required: []
    }
  },
  {
    name: 'getTopCustomersBySalesVolume',
    description: 'Get top N customers with highest sales volume (Ciro / Satış Hacmi). For questions like "bugün en çok fatura kesilen", "dün en çok satış yapılan", "bu ayki ciro liderleri", pass day="today" / day="yesterday" or month="current" / specific month name.',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'NUMBER', description: 'Number of top customers to return (default: 10)' },
        day: { type: 'STRING', description: 'Optional day filter: "today" / "bugün", "yesterday" / "dün", or YYYY-MM-DD date' },
        month: { type: 'STRING', description: 'Optional month name or "current" / "bu ay" (e.g. "current", "Temmuz", "07")' },
        year: { type: 'STRING', description: 'Optional year (e.g. "2026")' }
      },
      required: []
    }
  },
  {
    name: 'getInvoiceControlReport',
    description: 'Get date-based invoice and collection control report for specific dates (e.g., "17 Temmuz 2026", "2026-07-16"), specific sales reps (e.g. "BERK KUTAY KORKMAZ", "ALİCAN AKBAŞ"), or find customers with unpaid invoices on a specific date. ALWAYS use this tool for questions like "X temsilcinin 17 temmuz faturaları", "16 temmuzda tahsilat alınmayan müşteriler", "tarih bazlı fatura kontrol". DİKKAT: Spesifik bir ÜRÜN için (örn: "150021 fatura edilen") soruluyorsa BU ARACI KULLANMA, getProductPenetration kullan!',
    parameters: {
      type: 'OBJECT',
      properties: {
        date: { type: 'STRING', description: 'Date to query (e.g. "17 Temmuz", "2026-07-17", "16 Temmuz 2026")' },
        salesRep: { type: 'STRING', description: 'Sales rep name (e.g. "BERK KUTAY KORKMAZ", "ALİCAN AKBAŞ")' },
        unpaidOnly: { type: 'BOOLEAN', description: 'Set to true to find customers who had sales invoices on that date but 0 collections (tahsilat alınmayan müşteriler)' }
      },
      required: []
    }
  },
  {
    name: 'getShipmentTrackingReport',
    description: 'Get live shipment tracking and daily order/collection report (Sevkiyat Takip, Sipariş, Emanet Sp, Tahsilat, Ortalama Vade). Use this tool for queries like "sevkiyat takip özetini göster", "bugünkü sipariş ve tahsilat durumu", "en çok siparişi olan müşteriler", "emanet siparişi olan cariler", "ortalama sipariş vadesi nedir".',
    parameters: {
      type: 'OBJECT',
      properties: {
        date: { type: 'STRING', description: 'Optional date query (default: today)' },
        salesRep: { type: 'STRING', description: 'Optional sales representative filter' },
        query: { type: 'STRING', description: 'Optional customer name or code filter' }
      },
      required: []
    }
  },
  {
    name: 'getAgingBreakdown',
    description: 'Get aging distribution overview (0-30, 31-60, 61-90, 90+ days overdue balances).',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'getOverdueCustomersList',
    description: 'Get a list of customers with overdue balances greater than a specific minimum days (e.g. 90 days).',
    parameters: {
      type: 'OBJECT',
      properties: {
        minDays: { type: 'NUMBER', description: 'Minimum days overdue (e.g., 90 for 90+ days)' }
      },
      required: ['minDays']
    }
  },
  {
    name: 'getPaymentMethodsBreakdown',
    description: 'Get breakdown of collection amounts by payment method (Nakit, Havale, Kredi Kartı, Hizmet, İade).',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'getSalesRepSummary',
    description: 'Get list of sales representatives with customer counts and portfolio balances.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'addManualInvoice',
    description: 'Add a new manual sales invoice for a customer.',
    parameters: {
      type: 'OBJECT',
      properties: {
        customerId: { type: 'STRING', description: 'Customer ID (e.g. 5000123456)' },
        amount: { type: 'NUMBER', description: 'Invoice amount in TL' },
        invoiceDate: { type: 'STRING', description: 'Date (YYYY-MM-DD)' },
        eDocumentNo: { type: 'STRING', description: 'Document number' },
        description: { type: 'STRING', description: 'Note' }
      },
      required: ['customerId', 'amount']
    }
  },
  {
    name: 'addManualCollection',
    description: 'Add a new manual collection / payment for a customer.',
    parameters: {
      type: 'OBJECT',
      properties: {
        customerId: { type: 'STRING', description: 'Customer ID (e.g. 5000123456)' },
        amount: { type: 'NUMBER', description: 'Payment amount in TL' },
        date: { type: 'STRING', description: 'Date (YYYY-MM-DD)' },
        method: { type: 'STRING', description: 'Method: "NAKİT", "HAVALE", "KREDİ_KARTI"' },
        eDocumentNo: { type: 'STRING', description: 'Receipt number' },
        description: { type: 'STRING', description: 'Note' }
      },
      required: ['customerId', 'amount']
    }
  },
  {
    name: 'bulkDeleteTransactions',
    description: 'Toplu veri silme aracı.',
    parameters: {
      type: 'OBJECT',
      properties: {
        year: { type: 'NUMBER', description: 'Sadece bu yıla ait verileri sil' },
        customerId: { type: 'STRING', description: 'Sadece bu müşteriye ait verileri sil' },
        type: { type: 'STRING', description: 'Silinecek işlem türü: "SATIS", "TAHSILAT", "CEK", "TUMU"' }
      },
      required: ['type']
    }
  },
  {
    name: 'addVirmanTransfer',
    description: 'Transfer debt / balance from Source customer to Target customer.',
    parameters: {
      type: 'OBJECT',
      properties: {
        sourceCustomerId: { type: 'STRING', description: 'Source customer ID' },
        targetCustomerId: { type: 'STRING', description: 'Target customer ID' },
        amount: { type: 'NUMBER', description: 'Transfer amount in TL' },
        date: { type: 'STRING', description: 'Date (YYYY-MM-DD)' },
        description: { type: 'STRING', description: 'Virman note' }
      },
      required: ['sourceCustomerId', 'targetCustomerId', 'amount']
    }
  },
  {
    name: 'getGlobalHighestTransactions',
    description: 'Get SINGLE highest record (tek bir rekor havale/fatura).',
    parameters: {
      type: 'OBJECT',
      properties: {
        type: { type: 'STRING', description: 'Transaction type: "TAHSILAT" or "SATIS"' },
        limit: { type: 'NUMBER', description: 'Number of records to return (default: 5)' }
      },
      required: []
    }
  },
  {
    name: 'getMonthlyComparisonReport',
    description: 'Compare sales, collections, and transactions between two months or date periods.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Optional customer name or code' },
        period1: { type: 'STRING', description: 'First month name or number' },
        period2: { type: 'STRING', description: 'Second month name or number' }
      },
      required: ['period1', 'period2']
    }
  },
  {
    name: 'getMonthlyRiskAndRevenueReport',
    description: 'Ay bazlı risk, ciro, tahsilat hacmi ve devreden borç yükünü detaylı hesaplar.',
    parameters: {
      type: 'OBJECT',
      properties: {
        year: { type: 'STRING', description: 'Yıl' },
        month: { type: 'STRING', description: 'Ay' },
        query: { type: 'STRING', description: 'Müşteri adı/kodu' }
      },
      required: []
    }
  },
  {
    name: 'getCollectionBreakdown',
    description: 'Get global breakdown of collections by payment method.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'getCustomerPaymentTrend',
    description: 'Get historical payment trend and actual payment days (3M, 6M, 12M days to pay).',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Customer query' }
      },
      required: []
    }
  },
  {
    name: 'calculateCustomerDebtToCollectionRisk',
    description: 'Calculates Debt-to-Collection Turnover Risk for a customer using Coverage Months = Net Debt / Monthly Avg Collection. Returns risk level (LOW, MEDIUM, HIGH) and turnover days.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Customer name, code (5000XXXXXX), or sign name' }
      },
      required: []
    }
  },
  {
    name: 'getDeepExecutiveAnalyticsOverview',
    description: 'Get deep executive analytics including 60+ days overdue customer list & ranking, 30k+ high risk customer list & ranking, active month vs previous month collection growth (MoM Growth), and top performing sales reps of the month.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'deleteTransaction',
    description: 'Delete a specific transaction by ID.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: { type: 'STRING', description: 'Transaction ID' },
        type: { type: 'STRING', description: 'Transaction type' }
      },
      required: ['id']
    }
  },
  {
    name: 'getCustomerCheques',
    description: 'Get cheques and senets list and total risk for a customer or globally.',
    parameters: {
      type: 'OBJECT',
      properties: {
        customerId: { type: 'STRING', description: 'Customer ID' },
        query: { type: 'STRING', description: 'Search query' }
      },
      required: []
    }
  },
  {
    name: 'addManualCheque',
    description: 'Add a new cheque or senet record for a customer.',
    parameters: {
      type: 'OBJECT',
      properties: {
        customerId: { type: 'STRING', description: 'Customer ID' },
        type: { type: 'STRING', description: 'Type: "ÇEK" or "SENET"' },
        amount: { type: 'NUMBER', description: 'Amount in TL' },
        docNo: { type: 'STRING', description: 'Document number' },
        subNo: { type: 'STRING', description: 'Sub number' },
        dueDate: { type: 'STRING', description: 'Due date' },
        bankName: { type: 'STRING', description: 'Bank name' },
        status: { type: 'STRING', description: 'Status' }
      },
      required: ['customerId', 'amount']
    }
  },
  {
    name: 'purgeTestImportRecords',
    description: 'Veritabanındaki test/geçici aktarım kayıtlarını temizler.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'runExcelVerificationTest',
    description: 'Run automated in-app test suite on uploaded or raw Excel file rows.',
    parameters: {
      type: 'OBJECT',
      properties: {
        fileType: { type: 'STRING', description: 'File type' },
        userScenarios: { type: 'STRING', description: 'Custom test instructions' }
      },
      required: []
    }
  },
  {
    name: 'mapAndImportExcel',
    description: 'Bilinmeyen Excel formatını aktarır.',
    parameters: {
      type: 'OBJECT',
      properties: {
        fileName: { type: 'STRING', description: 'File name' },
        targetType: { type: 'STRING', description: 'Target type' },
        customerIdField: { type: 'STRING', description: 'Customer ID field' },
        amountField: { type: 'STRING', description: 'Amount field' },
        defaultDate: { type: 'STRING', description: 'Default date' },
        defaultDescription: { type: 'STRING', description: 'Default description' }
      },
      required: ['fileName', 'targetType', 'customerIdField', 'amountField']
    }
  },
  {
    name: 'advancedMapAndImportExcel',
    description: 'Gelişmiş Excel dönüştürme ve aktarım.',
    parameters: {
      type: 'OBJECT',
      properties: {
        fileName: { type: 'STRING', description: 'File name' },
        jsFunctionBody: { type: 'STRING', description: 'JS code body' }
      },
      required: ['fileName', 'jsFunctionBody']
    }
  },
  {
    name: 'getFinancialHealthReport',
    description: 'Get CFO Executive Financial Health Report.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Search query' }
      },
      required: []
    }
  },
  {
    name: 'getParetoConcentrationAnalysis',
    description: 'Get Pareto (80/20) Sales Volume and Receivable Risk Concentration Analysis.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'importCustomerMaster',
    description: 'Yüklenen Müşteri Master Excel dosyasını aktarır.',
    parameters: {
      type: 'OBJECT',
      properties: {
        fileName: { type: 'STRING', description: 'File name' }
      },
      required: []
    }
  },
  {
    name: 'getCollectionEffectivenessIndex',
    description: 'Get Collection Effectiveness Index (CEI %).',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Search query' }
      },
      required: []
    }
  },
  {
    name: 'updateManualCheque',
    description: 'Update status of existing cheque/senet.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: { type: 'STRING', description: 'Cheque ID' },
        status: { type: 'STRING', description: 'Status' },
        description: { type: 'STRING', description: 'Description' }
      },
      required: ['id']
    }
  },
  {
    name: 'deleteManualCheque',
    description: 'Delete cheque/senet from database.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: { type: 'STRING', description: 'Cheque ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'reconcileChequesWithExcel',
    description: 'Reconcile database cheques with uploaded Excel.',
    parameters: {
      type: 'OBJECT',
      properties: {
        fileName: { type: 'STRING', description: 'File name' },
        action: { type: 'STRING', description: 'Action' }
      },
      required: []
    }
  },
  {
    name: 'readUploadedExcelData',
    description: 'Yüklenen geçici Excel dosyasının ham satırlarını okur.',
    parameters: {
      type: 'OBJECT',
      properties: {
        fileName: { type: 'STRING', description: 'File name' },
        limit: { type: 'NUMBER', description: 'Limit' }
      },
      required: []
    }
  },
  // B12 güvenlik düzeltmesi: 'executeDynamicAnalyticsQuery' aracı LLM araç
  // yüzeyinden tamamen kaldırıldı (sandbox'sız `new Function` kod yürütme riski).
  {
    name: 'defineSubagent',
    description: 'Define brand-new subagent.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Name' },
        role: { type: 'STRING', description: 'Role' },
        description: { type: 'STRING', description: 'Description' },
        systemPrompt: { type: 'STRING', description: 'System prompt' }
      },
      required: ['name', 'role', 'description', 'systemPrompt']
    }
  },
  {
    name: 'invokeSubagent',
    description: 'Invoke subagent.',
    parameters: {
      type: 'OBJECT',
      properties: {
        subagentName: { type: 'STRING', description: 'Subagent name' },
        taskPrompt: { type: 'STRING', description: 'Task prompt' }
      },
      required: ['subagentName', 'taskPrompt']
    }
  },
  {
    name: 'calculateSelloutProbability',
    description: 'Sellout (hedef/gerçekleşen) durumunu, ay sonu projeksiyonunu ve hedefe ulaşma olasılığını hesaplar. Temsilci, Bölge (SSM) veya Şirket Geneli (TÜMÜ) için kullanılabilir.',
    parameters: {
      type: 'OBJECT',
      properties: {
        entityName: { type: 'STRING', description: 'Temsilci veya SSM adı. Şirket geneli için boş bırakın.' },
        month: { type: 'STRING', description: 'YYYY-MM formatında ay (örn: 2026-07). Boş bırakılırsa içinde bulunulan ay kullanılır.' }
      },
      required: []
    },
    execute: async (args: any) => {
      const { getSelloutPerformance, calculateAdvancedSelloutForecast } = await import('../calculations/selloutCalculations');
      const targetMonth = args.month || new Date().toISOString().slice(0, 7);
      const performance = getSelloutPerformance(targetMonth);
      const forecast = calculateAdvancedSelloutForecast(targetMonth, args.entityName);
      
      let targetEntity: any = performance.companyTotal;
      if (args.entityName) {
        const ssmMatch = performance.ssmList.find((s: any) => s.ssmName.toLowerCase() === args.entityName.toLowerCase());
        if (ssmMatch) {
          targetEntity = ssmMatch;
        } else {
          for (const ssm of performance.ssmList) {
            const repMatch = ssm.reps.find((r: any) => r.repName.toLowerCase() === args.entityName.toLowerCase());
            if (repMatch) {
              targetEntity = repMatch;
              break;
            }
          }
        }
      }
      
      if (!targetEntity) return { error: 'Belirtilen Temsilci veya SSM bulunamadı.' };
      
      const totalRealized = targetEntity.totalRealized || 0;
      const totalTarget = targetEntity.totalTarget || 0;
      
      return {
        entity: targetEntity.ssmName || targetEntity.repName || 'Şirket Geneli',
        targetMonth,
        openChannel: {
          target: targetEntity.openChannelTarget || 0,
          realized: targetEntity.openChannelRealized || 0
        },
        closedChannel: {
          target: targetEntity.closedChannelTarget || 0,
          realized: targetEntity.closedChannelRealized || 0
        },
        total: {
          target: totalTarget,
          realized: totalRealized,
          coveragePercent: totalTarget > 0 ? Math.round((totalRealized/totalTarget)*100) : 0
        },
        historicalSeasonality: {
          historicalSeasonalityRatioPercent: Math.round(forecast.historicalSeasonalityRatio * 100),
          lateMonthSpikePercent: Math.round(forecast.lateMonthSpikeRatio * 100),
        },
        forecast: {
          daysElapsed: forecast.daysElapsed,
          totalDaysInMonth: forecast.totalDaysInMonth,
          dailyVelocity: forecast.dailyVelocity,
          requiredDailyVelocityToHitTarget: forecast.requiredDailyVelocity,
          linearForecastLiters: forecast.linearForecast,
          linearForecastPercent: forecast.linearPercent,
          cfoWeightedForecastLiters: forecast.weightedForecast,
          cfoWeightedForecastPercent: forecast.weightedPercent,
          cfoAnalysisText: forecast.cfoCommentary
        }
      };
    }
  },
  {
    name: 'getSalesFkns',
    description: 'Bir satış temsilcisinin FKNS (Fatura Kesilmiş Nokta Sayısı) oranını hesaplar. Kanalı AÇIK veya KAPALI olarak filtreleyebilir.',
    parameters: {
      type: 'OBJECT',
      properties: {
        salesRep: { type: 'STRING', description: 'Temsilcinin adı (örn: DOĞUŞ ARK)' },
        channel: { type: 'STRING', description: 'AÇIK, KAPALI veya TÜMÜ (varsayılan TÜMÜ)' },
        month: { type: 'STRING', description: 'YYYY-MM formatında ay (örn: 2026-07). Boş bırakılırsa içinde bulunulan ay kullanılır.' }
      },
      required: []
    },
    execute: async (args: any) => {
      const ch = args.channel && ['AÇIK', 'KAPALI'].includes(args.channel.toUpperCase()) ? args.channel.toUpperCase() : 'TÜMÜ';
      const targetMonth = args.month || new Date().toISOString().slice(0, 7);
      const result = calculateFknsForRep(args.salesRep || '', ch as any, targetMonth);
      const repLabel = result.salesRep ? result.salesRep : 'Tüm Temsilciler';
      const limit = 40;
      let uninvoicedText = result.uninvoicedCustomers.slice(0, limit).map((c: any) => `- ${c.name} (No: ${c.id})`).join('\n');
      if (result.uninvoicedCustomers.length > limit) {
        uninvoicedText += `\n... ve ${result.uninvoicedCustomers.length - limit} adet daha müşteri var.`;
      }
      
      let invoicedText = (result.invoicedCustomers || []).slice(0, limit).map((c: any) => `- ${c.name} (No: ${c.id})`).join('\n');
      if ((result.invoicedCustomers || []).length > limit) {
        invoicedText += `\n... ve ${(result.invoicedCustomers || []).length - limit} adet daha müşteri var.`;
      }

      return `FKNS Analizi (${repLabel} - ${result.channel} Kanalı - Dönem: ${targetMonth}):
- Toplam Aktif Müşteri: ${result.totalActiveCustomers}
- Fatura Kesilen Müşteri: ${result.invoicedCustomersCount}
- FKNS Oranı: %${result.fknsPercentage}

Fatura KESİLEN Noktalar (${(result.invoicedCustomers || []).length} adet):
${invoicedText || 'Kesilen nokta bulunamadı.'}

Fatura KESİLMEYEN Noktalar (${result.uninvoicedCustomers.length} adet):
${uninvoicedText}`;
    }
  },
  {
    name: 'getProductPenetration',
    description: 'Spesifik bir ürünün (ürün adı veya 5-6 haneli ürün kodu, örn: 150021, Corona) müşterilere satılıp satılmadığını (fatura edilip edilmediğini) analiz eder. "150021 efes kutu fatura edilen müşteriler", "bu ürünü alanlar", "x ürününü kimler aldı" gibi ÜRÜN BAZLI sorular için KESİNLİKLE BU ARACI KULLAN.',
    parameters: {
      type: 'OBJECT',
      properties: {
        salesRep: { type: 'STRING', description: 'Temsilcinin adı (örn: DOĞUŞ ARK)' },
        materialName: { type: 'STRING', description: 'Ürün kodu veya ürün adı (örn: 150021, Corona, Bud)' },
        channel: { type: 'STRING', description: 'AÇIK, KAPALI veya TÜMÜ (varsayılan TÜMÜ)' },
        month: { type: 'STRING', description: 'YYYY-MM formatında ay (örn: 2026-07). Boş bırakılırsa içinde bulunulan ay kullanılır.' }
      },
      required: ['materialName']
    },
    execute: async (args: any) => {
      const ch = args.channel && ['AÇIK', 'KAPALI'].includes(args.channel.toUpperCase()) ? args.channel.toUpperCase() : 'TÜMÜ';
      const targetMonth = args.month || new Date().toISOString().slice(0, 7);
      const result = calculateProductPenetration(args.salesRep || '', args.materialName, ch as any, targetMonth);
      const repLabel = result.salesRep ? result.salesRep : 'Tüm Temsilciler';
      
      if (result.isIrrelevant) {
        return `Ürün Penetrasyon Analizi (${repLabel} - ${result.channel} Kanalı - Dönem: ${targetMonth} - Ürün: ${result.materialName}):
Bu ürün (örn. Fıçı ürünü), ${result.channel} kanalında "İlgisiz Kanal" olarak değerlendirildiği için hedef / penetrasyon hesaplamasına dahil edilmemektedir. FKNS %0 olarak kabul edilir.`;
      }

      const limit = 40;
      let nonBuyersText = result.nonBuyers.slice(0, limit).map((c: any) => `- ${c.name} (No: ${c.id})`).join('\n');
      if (result.nonBuyers.length > limit) {
        nonBuyersText += `\n... ve ${result.nonBuyers.length - limit} adet daha müşteri var.`;
      }
      let buyersText = (result.buyers || []).slice(0, limit).map((c: any) => `- ${c.name} (No: ${c.id})`).join('\n');
      if ((result.buyers || []).length > limit) {
        buyersText += `\n... ve ${(result.buyers || []).length - limit} adet daha müşteri var.`;
      }
      return `Ürün Penetrasyon Analizi (${repLabel} - ${result.channel} Kanalı - Dönem: ${targetMonth} - Ürün: ${result.materialName}):
- Toplam Aktif Müşteri: ${result.totalActiveCustomers}
- Alan Müşteri Sayısı: ${result.buyersCount}
- Penetrasyon (Ürün FKNS) Oranı: %${result.penetrationPercentage}

Bu Ürünü ALAN Noktalar (${(result.buyers || []).length} adet):
${buyersText || 'Alan müşteri bulunamadı.'}

Bu Ürünü ALMAYAN Noktalar (${result.nonBuyers.length} adet):
${nonBuyersText || 'Almayan müşteri bulunamadı.'}`;
    }
  },
  {
    name: 'getMetricRegistry',
    description: 'Yapay zeka analiz motorunun metrik formüllerini (MET) ve güncel kurallarını backendden getirir. Özel formülleri öğrenmek için kullanın.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'getAiLogs',
    description: 'Yapay zeka analiz motorunun (AIENG) sistem arka planında yaptığı otomatik kayıtları (logs) getirir.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'getFinancialReport',
    description: 'Temel ve karmaşık finansal metrikleri, portföy yoğunlaşması (pareto), ciro, cari açık gibi raporları getirir. (FAN-001, vb.)',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Müşteri, temsilci veya kanal sorgusu' },
        metric: { type: 'STRING', description: 'İstenen metrik (örn: yoğunlaşma, ciro)' }
      },
      required: []
    }
  },
  {
    name: 'getAgingMigration',
    description: 'Aylık aging (yaşlandırma) geçiş matrisini üretir. (FAN-002)',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'getInvoiceVintage',
    description: 'Fatura kohortu/vintage kapanma eğrisini hesaplar. (FAN-003)',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'getCashForecast',
    description: '13 haftalık nakit tahminini ve tahsilat görünümünü üretir (FORECAST). Tahmini kesin gerçekleşmiş para gibi yorumlama. (FAN-010)',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'runFinancialScenario',
    description: 'Gerçek veriyi değiştirmeden varsayımsal stres testi, karşı taraf riski ve beklenen zarar senaryoları çalıştırır (SCENARIO). (FAN-016, FAN-017, FAN-018)',
    parameters: {
      type: 'OBJECT',
      properties: {
        scenarioType: { type: 'STRING', description: 'Senaryo tipi (stres, karsi_taraf, beklenen_zarar)' }
      },
      required: ['scenarioType']
    }
  },
  {
    name: 'getRestatementImpact',
    description: 'Geçmiş raporların güncel kurallarla yeniden açıklanma (restatement) farkını gösterir. (FAN-019)',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'getCollectionPriority',
    description: 'Tahsilat takip önceliği listesini üretir (RECOMMENDATION). Risk maddiliği ve yaşlanma şiddetine göre sıralar. (FAN-015)',
    parameters: { type: 'OBJECT', properties: {} }
  }
];
