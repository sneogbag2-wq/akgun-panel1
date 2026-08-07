export function createDispatchRepository({ userClient }) {
  if (!userClient?.rpc || !userClient?.from) {
    throw new TypeError('Dispatch repository requires Supabase clients');
  }

  const data = async (operation) => {
    const { data: value, error } = await operation;
    if (error) throw new Error(error.message);
    return value;
  };

  return Object.freeze({
    today: () => data(userClient.rpc('dispatch_today_orders')),
    summary: () => data(userClient.rpc('dispatch_today_summary')),
    orders: (query) => data(userClient.rpc('dispatch_orders', { p_query: query })),
    order: (salesDocumentNo) => data(userClient.rpc('dispatch_order_detail', { p_document_no: salesDocumentNo })),
    exceptions: (query) => data(userClient.rpc('dispatch_exceptions', { p_query: query })),
    handoffStatus: () => data(userClient.rpc('dispatch_handoff_status')),
    previewAction: (id, action) => data(userClient.rpc('dispatch_preview_action', { p_id: id, p_action: action })),
    commitAction: (id, action) => data(userClient.rpc('dispatch_commit_action', { p_id: id, p_action: action }))
  });
}
