export class ContextEngine {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  async searchContext(query) {
    try {
      const response = await this.apiClient.get(`/memory/search?q=${encodeURIComponent(query)}`);
      
      if (response.fallback) {
        return { isFallback: true, context: '' }; // Graceful degradation
      }
      
      return { isFallback: false, context: response.data.map(m => m.content).join('\n') };
    } catch (err) {
      // API tam çökerse (Network Error vs)
      console.error('Context Engine Offline:', err);
      return { isFallback: true, context: '' }; // Standart moda düş
    }
  }
}
