export function createInvoiceControlRepository({ userClient }) {
  if (!userClient?.rpc || !userClient?.from) {
    throw new TypeError('Invoice control repository requires Supabase clients');
  }

  const data = async (operation) => {
    const { data: value, error } = await operation;
    if (error) throw new Error(error.message);
    return value;
  };

  return Object.freeze({
    controls: (date) => data(userClient.rpc('invoice_controls_by_date', { p_date: date })),
    summary: (date) => data(userClient.rpc('invoice_controls_summary', { p_date: date })),
    invoiceDetail: (invoiceId) => data(userClient.rpc('invoice_control_detail', { p_invoice_id: invoiceId })),
    evidence: (invoiceId) => data(userClient.rpc('invoice_control_evidence', { p_invoice_id: invoiceId })),
    exceptions: (query) => data(userClient.rpc('invoice_control_exceptions', { p_query: query }))
  });
}
