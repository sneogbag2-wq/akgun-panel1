export function createCommercialStockRepository({ userClient }) {
  if (!userClient?.rpc || !userClient?.from) {
    throw new TypeError('Commercial stock repository requires Supabase clients');
  }

  const data = async (operation) => {
    const { data: value, error } = await operation;
    if (error) throw new Error(error.message);
    return value;
  };

  return Object.freeze({
    validate: (input) => data(userClient.rpc('validate_commercial_stock_batch', { p_batch_id: input.batchId })),
    publish: (input) => data(userClient.rpc('publish_commercial_stock', { p_batch_id: input.batchId })),
    summary: () => data(userClient.from('commercial_stock_import_check').select('*, commercial_stock_import(*)')),
    customers: (query) => data(userClient.rpc('commercial_stock_customers', { p_query: query })),
    products: (query) => data(userClient.rpc('commercial_stock_products', { p_query: query })),
    responsibility: (query) => data(userClient.rpc('commercial_stock_responsibility', { p_query: query })),
    exceptions: (query) => data(userClient.rpc('commercial_stock_exceptions', { p_query: query })),
  });
}
