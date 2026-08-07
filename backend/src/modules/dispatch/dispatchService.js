export function createDispatchService(deps = {}) {
  const repository = deps.repository;

  return Object.freeze({
    async getTodayOrders() {
      if (!repository) throw new Error('Repository is required');
      return await repository.today();
    },

    async getSummary() {
      if (!repository) throw new Error('Repository is required');
      return await repository.summary();
    },

    async getOrders(query) {
      if (!repository) throw new Error('Repository is required');
      return await repository.orders(query);
    },

    async getOrder(salesDocumentNo) {
      if (!repository) throw new Error('Repository is required');
      return await repository.order(salesDocumentNo);
    },


    async getExceptions(query) {
      if (!repository) throw new Error('Repository is required');
      return await repository.exceptions(query);
    },

    async getHandoffStatus() {
      if (!repository) throw new Error('Repository is required');
      return await repository.handoffStatus();
    },

    async previewAction(id, action) {
      if (!repository) throw new Error('Repository is required');
      return await repository.previewAction(id, action);
    },

    async commitAction(id, action) {
      if (!repository) throw new Error('Repository is required');
      return await repository.commitAction(id, action);
    }
  });
}
