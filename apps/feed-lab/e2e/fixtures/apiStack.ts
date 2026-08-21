const API_BASE_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';

export async function isApiHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export { API_BASE_URL };
