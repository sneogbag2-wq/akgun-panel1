import { sendAiMessage, getApiKeys } from './aiService';

export interface LiveAiEvaluationScenario {
  id: string;
  query: string;
  requiredTool: string;
  requiredText?: RegExp;
}

export interface LiveAiEvaluationOutcome {
  id: string;
  passed: boolean;
  provider: 'gemini' | 'offline';
  modelName?: string;
  toolCalls: string[];
  responseLength: number;
  failure?: string;
}

/**
 * Small, real-provider evaluation set. It sends no customer data and verifies that
 * the observable output came from Gemini rather than the offline safety fallback.
 */
export const LIVE_AI_EVALUATION_SCENARIOS: LiveAiEvaluationScenario[] = [
  { id: 'company-summary', query: 'Şirketin genel finansal özetini ver.', requiredTool: 'getGlobalFinancialSummary' },
  { id: 'customer-statement', query: 'Marmara Market ekstresini göster.', requiredTool: 'getCustomerStatement' },
  { id: 'collection-cei', query: 'Tahsilat etkinlik endeksi CEI nedir?', requiredTool: 'getCollectionEffectivenessIndex' },
  { id: 'financial-risk', query: 'Finansal sağlık ve risk raporu hazırla; stratejik risk uyarısı ekle.', requiredTool: 'getFinancialHealthReport', requiredText: /risk/i },
  { id: 'shipment', query: 'Sevkiyat takip özetini göster.', requiredTool: 'getShipmentTrackingReport' },
  { id: 'sellout', query: 'Sellout performans olasılığını hesapla.', requiredTool: 'calculateSelloutProbability' },
  { id: 'sales-rep', query: 'Temsilci performans özetini göster.', requiredTool: 'getSalesRepSummary' },
  { id: 'overdue', query: 'Vadesi geçmiş carileri göster.', requiredTool: 'getOverdueCustomersList' },
  { id: 'highest-collection', query: 'En yüksek tahsilat kaç TL?', requiredTool: 'getGlobalHighestTransactions' },
  { id: 'payment-methods', query: 'Ödeme yöntemlerine göre tahsilat dağılımını ver.', requiredTool: 'getPaymentMethodsBreakdown' },
  { id: 'product-penetration', query: '150021 ürün penetrasyonu nedir?', requiredTool: 'getProductPenetration' },
  { id: 'customer-balance', query: 'Marmara Market bakiyesi ne kadar?', requiredTool: 'searchCustomers' },
  { id: 'mutation-is-pending', query: '5000100015 müşterisine 1000 TL fatura ekle.', requiredTool: 'addManualInvoice' },
  { id: 'excel', query: 'Excel dosyasını analiz et.', requiredTool: 'readUploadedExcelData' },
  { id: 'general-status', query: 'Bugünkü genel durumu özetle.', requiredTool: 'getCurrentStatus' }
];

export async function runLiveAiEvaluation(scenarios: readonly LiveAiEvaluationScenario[] = LIVE_AI_EVALUATION_SCENARIOS): Promise<LiveAiEvaluationOutcome[]> {
  if (getApiKeys().length === 0) {
    throw new Error('LIVE_AI_EVAL_NO_API_KEY: VITE_GEMINI_API_KEY çalışma zamanında tanımlı olmalıdır.');
  }

  const outcomes: LiveAiEvaluationOutcome[] = [];
  for (const scenario of scenarios) {
    try {
      const result = await sendAiMessage(scenario.query);
      const toolCalls = result.toolCalls.map((call) => call.toolName);
      const hasTool = toolCalls.includes(scenario.requiredTool);
      const hasText = !scenario.requiredText || scenario.requiredText.test(result.text || '');
      const isLiveGemini = result.provider === 'gemini';
      outcomes.push({
        id: scenario.id,
        passed: isLiveGemini && hasTool && hasText,
        provider: (result.provider as 'gemini' | 'offline') || 'offline',
        modelName: result.modelName,
        toolCalls,
        responseLength: (result.text || '').length,
        failure: !isLiveGemini
          ? 'Canlı Gemini yanıtı yerine çevrimdışı yedek yanıt kullanıldı.'
          : hasTool
            ? (hasText ? undefined : 'Yanıtta beklenen kalite işareti bulunamadı.')
            : `Beklenen araç çağrılmadı: ${scenario.requiredTool}`
      });
    } catch (error) {
      outcomes.push({
        id: scenario.id,
        passed: false,
        provider: 'offline',
        toolCalls: [],
        responseLength: 0,
        failure: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return outcomes;
}
