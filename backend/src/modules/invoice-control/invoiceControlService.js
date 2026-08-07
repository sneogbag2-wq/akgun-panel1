export function createInvoiceControlService(deps = {}) {
  const repository = deps.repository;

  return Object.freeze({
    async getControls(date) {
      if (!repository) throw new Error('Repository is required');
      return await repository.controls(date);
    },

    async getSummary(date) {
      if (!repository) throw new Error('Repository is required');
      return await repository.summary(date);
    },

    async getInvoiceDetail(invoiceId) {
      if (!repository) throw new Error('Repository is required');
      return await repository.invoiceDetail(invoiceId);
    },

    async getEvidence(invoiceId) {
      if (!repository) throw new Error('Repository is required');
      return await repository.evidence(invoiceId);
    },

    async getExceptions(query) {
      if (!repository) throw new Error('Repository is required');
      return await repository.exceptions(query);
    }
  });
}
