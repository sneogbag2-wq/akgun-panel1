export interface Attachment {
  fileName: string;
  mimeType: string;
  base64?: string;
  textContent?: string;
  displayContent?: string;
  isImage?: boolean;
  isPdf?: boolean;
  isExcel?: boolean;
  rowCount?: number;
}

export interface AiToolCall {
  toolName: string;
  args?: Record<string, any>;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: AiToolCall[];
  attachments?: Attachment[];
  reports?: AiReportDescriptor[];
  timestamp: string;
  isStreaming?: boolean;
  isError?: boolean;
}

export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface InvoiceControlCustomer {
  customerId: string;
  customerName: string;
  signName?: string;
  salesRep?: string;
  salesRepName?: string;
  balance: number;
  formattedBalance: string;
  averageVadeDays?: number;
  invoiceTotal: number;
  formattedInvoiceTotal: string;
  collectionTotal: number;
  formattedCollectionTotal: string;
  prevCollectionTotal: number;
  formattedPrevCollectionTotal: string;
  isUnpaidOnDate: boolean;
}

export interface InvoiceControlReport {
  targetDate: string;
  salesRepFilter: string;
  isUnpaidFilterActive: boolean;
  totalMatchingCustomers: number;
  unpaidCustomerCount: number;
  totalInvoiceAmount: number;
  formattedTotalInvoiceAmount: string;
  totalCollectionAmount: number;
  formattedTotalCollectionAmount: string;
  totalPrevCollectionAmount: number;
  formattedTotalPrevCollectionAmount: string;
  customerList: InvoiceControlCustomer[];
  customers?: InvoiceControlCustomer[];
}

// ==========================================
// P3-4: Subagent & Report Types
// ==========================================

export type AiReportDataType = 'table' | 'keyValue' | 'list' | 'text' | 'identifier' | 'currency' | 'percentage' | 'date' | 'number';

export interface AiReportColumn {
  key: string;
  header: string;
  dataType?: AiReportDataType;
  isNumeric?: boolean;
}

export interface AiReportDescriptor {
  id: string;
  title: string;
  subtitle?: string;
  fileName?: string;
  type: AiReportDataType;
  columns?: AiReportColumn[];
  rows?: any[];
  sheetName?: string;
  data: any;
  rowCount?: number;
  summaryBoxes?: any;
  chartType?: 'bar' | 'line' | 'pie';
  chartData?: any;
  isExportable?: boolean;
}

export interface AiAnalysisResult {
  markdownText?: string;
  scope?: string;
  metrics?: any;
  reports?: AiReportDescriptor[];
}

export interface DynamicSubagentInput {
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
}

export interface DynamicSubagent {
  id?: string;
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  createdTime?: string;
  updatedTime?: string;
  isBuiltIn?: boolean;
}

// ==========================================
// P3-4: Tool Arguments Definitions
// ==========================================
export interface DiscoverMoreToolsArgs {
  topic?: string;
}

export interface SearchCustomersArgs {
  query?: string;
}

export interface GetCustomerDetailsArgs {
  customerId?: string;
}

export interface GetCustomerStatementArgs {
  customerId?: string;
}

export interface QueryTransactionsArgs {
  query?: string;
  transactionType?: string;
  sortBy?: string;
  limit?: number;
}

export interface GetTopDebtorsArgs {
  limit?: number;
}

export interface GetTopCustomersBySalesVolumeArgs {
  limit?: number;
  day?: string;
  month?: string;
  year?: string;
}

export interface GetInvoiceControlReportArgs {
  date?: string;
  salesRep?: string;
  unpaidOnly?: boolean;
}

export interface GetShipmentTrackingReportArgs {
  date?: string;
  salesRep?: string;
  query?: string;
}

export interface GetOverdueCustomersListArgs {
  minDays?: number;
}

export interface AddManualInvoiceArgs {
  customerId?: string;
  amount?: number;
  invoiceDate?: string;
  eDocumentNo?: string;
  description?: string;
}

export interface AddManualCollectionArgs {
  customerId?: string;
  amount?: number;
  date?: string;
  method?: string;
  eDocumentNo?: string;
  description?: string;
}

export interface BulkDeleteTransactionsArgs {
  year?: number;
  customerId?: string;
  type?: string;
}

export interface AddVirmanTransferArgs {
  sourceCustomerId?: string;
  targetCustomerId?: string;
  amount?: number;
  date?: string;
  description?: string;
}

export interface GetGlobalHighestTransactionsArgs {
  type?: string;
  limit?: number;
}

export interface GetMonthlyComparisonReportArgs {
  query?: string;
  period1?: string;
  period2?: string;
}

export interface GetMonthlyRiskAndRevenueReportArgs {
  year?: string;
  month?: string;
  query?: string;
}

export interface GetCustomerPaymentTrendArgs {
  query?: string;
}

export interface CalculateCustomerDebtToCollectionRiskArgs {
  query?: string;
}

export interface DeleteTransactionArgs {
  id?: string;
  type?: string;
}

export interface GetCustomerChequesArgs {
  customerId?: string;
  query?: string;
}

export interface AddManualChequeArgs {
  customerId?: string;
  type?: string;
  amount?: number;
  docNo?: string;
  subNo?: string;
  dueDate?: string;
  bankName?: string;
  status?: string;
}

export interface RunExcelVerificationTestArgs {
  fileType?: string;
  userScenarios?: string;
}

export interface MapAndImportExcelArgs {
  fileName?: string;
  targetType?: string;
  customerIdField?: string;
  amountField?: string;
  defaultDate?: string;
  defaultDescription?: string;
}

export interface AdvancedMapAndImportExcelArgs {
  fileName?: string;
  jsFunctionBody?: string;
}

export interface GetFinancialHealthReportArgs {
  query?: string;
}

export interface ImportCustomerMasterArgs {
  fileName?: string;
}

export interface GetCollectionEffectivenessIndexArgs {
  query?: string;
}

export interface UpdateManualChequeArgs {
  id?: string;
  status?: string;
  description?: string;
}

export interface DeleteManualChequeArgs {
  id?: string;
}

export interface ReconcileChequesWithExcelArgs {
  fileName?: string;
  action?: string;
}

export interface ReadUploadedExcelDataArgs {
  fileName?: string;
  limit?: number;
}

export interface DefineSubagentArgs {
  name?: string;
  role?: string;
  description?: string;
  systemPrompt?: string;
}

export interface InvokeSubagentArgs {
  subagentName?: string;
  taskPrompt?: string;
}

export interface CalculateSelloutProbabilityArgs {
  entityName?: string;
  month?: string;
}

export interface GetSalesFknsArgs {
  salesRep?: string;
  channel?: string;
  month?: string;
}

export interface GetProductPenetrationArgs {
  salesRep?: string;
  materialName?: string;
  channel?: string;
  month?: string;
}

// ==========================================
// AI-01: Common Results, Provenance and Schemas
// ==========================================

export interface SemanticQueryPlan {
  intent_id: string;
  domain: string;
  metric_ids: string[];
  entity_refs: string[];
  dimensions?: string[];
  filters?: Record<string, any>;
  period?: string;
  comparison_periods?: string[];
  value_type?: string;
  output_mode?: string;
  operation_mode?: string;
  assumptions?: string[];
  ambiguities?: string[];
  confidence: number;
}

export interface MetricResultEnvelope {
  metric_result_id: string;
  metric_id: string;
  metric_version: string;
  calculation_run_id: string;
  value: number | string;
  unit: string;
  value_type: string;
  scope?: string;
  dimensions?: Record<string, any>;
  filters?: Record<string, any>;
  period?: string;
  as_of?: string;
  source_snapshots?: string[];
  formula_ref?: string;
  numerator?: number;
  denominator?: number;
  exclusions?: any;
  coverage?: number;
  data_quality_issues?: string[];
  rounding_policy?: string;
  status: string;
}

export type ClaimType = 'FACT' | 'INFERENCE' | 'FORECAST' | 'SCENARIO' | 'RECOMMENDATION';

export interface AiAnalysisClaim {
  claim_id: string;
  claim_type: ClaimType;
  text: string;
  supporting_metric_result_ids?: string[];
  confidence?: number;
  materiality?: string;
  caveats?: string[];
  policy_id?: string;
}

export interface MutationPreview {
  operation_id: string;
  operation_type: string;
  target_ids?: string[];
  before?: any;
  proposed_after?: any;
  financial_effects?: any;
  affected_metrics?: string[];
  warnings?: string[];
  idempotency_key?: string;
  preview_hash: string;
  requested_by?: string;
  expires_at?: string;
}
