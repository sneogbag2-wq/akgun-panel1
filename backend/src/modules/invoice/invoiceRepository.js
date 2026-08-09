export function createInvoiceRepository({ userClient, serviceClient }) {
  return {
    async parseSales(batchId, rows = [], correlationId) {
      const { data, error } = await userClient.rpc('parse_sales_batch', {
        p_batch_id: batchId,
        p_rows: Array.isArray(rows) ? rows : [],
        p_parser_version: 'v1.0.0',
        p_correlation_id: correlationId
      });
      if (error) throw new Error(error.message);
      return data;
    },
    async validateSales(batchId, correlationId) {
      const { data, error } = await userClient.rpc('validate_sales_batch', {
        p_batch_id: batchId,
        p_correlation_id: correlationId
      });
      if (error) throw new Error(error.message);
      return data;
    },
    async publishSales(batchId, input, correlationId) {
      const { data, error } = await userClient.rpc('publish_sales_batch', {
        p_batch_id: batchId,
        p_validation_run_id: input.expectedValidationRunId,
        p_idempotency_key: input.idempotencyKey,
        p_correlation_id: correlationId
      });
      if (error) throw new Error(error.message);
      return data;
    }
  };
}
