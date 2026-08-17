const API_BASE_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';

export async function isApiHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function waitForApiHealth(): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await isApiHealthy()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`API not healthy at ${API_BASE_URL}`);
}

export { API_BASE_URL };
