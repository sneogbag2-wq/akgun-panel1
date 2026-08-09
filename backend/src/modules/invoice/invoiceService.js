export function createInvoiceService(repository) {
  return {
    async parse(batchId, rows, correlationId) {
      return repository.parseSales(batchId, rows, correlationId);
    },
    async validate(batchId, correlationId) {
      return repository.validateSales(batchId, correlationId);
    },
    async publish(batchId, input, correlationId) {
      return repository.publishSales(batchId, input, correlationId);
    },
    async list(query) {
      return { data: [], total: 0 };
    }
  };
}
