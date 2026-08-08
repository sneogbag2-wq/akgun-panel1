// Prod'da (Vercel) backend aynı domain altında /api/v2 olarak servis edilir.
// Lokal geliştirmede .env içindeki VITE_API_BASE_URL (örn. http://localhost:3001/api/v2) kullanılır.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v2';

export async function fetchV4Api(endpoint: string, options?: RequestInit) {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {})
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[V4 API HATA] ${endpoint}:`, error);
    throw error;
  }
}
