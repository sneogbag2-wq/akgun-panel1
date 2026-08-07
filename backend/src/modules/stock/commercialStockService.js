export function createCommercialStockService(deps = {}) {
  const repository = deps.repository;

  return Object.freeze({
    async validateImport(batchId) {
      if (!repository) throw new Error('Repository is required');
      return await repository.validate({ batchId });
    },

    async publishImport(batchId) {
      if (!repository) throw new Error('Repository is required');
      return await repository.publish({ batchId });
    },

    async getSummary(filters) {
      if (!repository) throw new Error('Repository is required');
      return await repository.summary();
    },

    async getCustomers(query) {
      if (!repository) throw new Error('Repository is required');
      return await repository.customers(query);
    },

    async getProducts(query) {
      if (!repository) throw new Error('Repository is required');
      return await repository.products(query);
    },

    async getResponsibility(query) {
      if (!repository) throw new Error('Repository is required');
      return await repository.responsibility(query);
    },

    async getExceptions(query) {
      if (!repository) throw new Error('Repository is required');
      return await repository.exceptions(query);
    }
  });
}

