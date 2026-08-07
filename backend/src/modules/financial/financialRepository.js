export function createFinancialRepository({ userClient }) {
  if (!userClient?.rpc || !userClient?.from) {
    throw new TypeError('Financial repository requires Supabase clients');
  }

  const data = async (operation) => {
    const { data: value, error } = await operation;
    if (error) throw new Error(error.message);
    return value;
  };

  return Object.freeze({
    // Retrieve base metric data for calculation
    getReceivableLots: (customerId) => data(userClient.rpc('financial_get_receivable_lots', { p_customer_id: customerId })),
    getHealthScoreComponents: (customerId) => data(userClient.rpc('financial_get_health_components', { p_customer_id: customerId })),
    getLimitFactors: (customerId) => data(userClient.rpc('financial_get_limit_factors', { p_customer_id: customerId })),
    
    // Save metric results to metric_results
    saveMetricResult: (runId, customerId, metricCode, metricValue) => 
      data(userClient.from('metric_results').insert([{ run_id: runId, customer_id: customerId, metric_code: metricCode, metric_value: metricValue }])),
      
    getMetricResult: (customerId, metricCode) => 
      data(userClient.from('metric_results').select('*').eq('customer_id', customerId).eq('metric_code', metricCode).order('created_at', { ascending: false }).limit(1).maybeSingle())
  });
}
