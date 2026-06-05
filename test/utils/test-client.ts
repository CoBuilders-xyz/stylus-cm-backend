import axios, { AxiosInstance, AxiosResponse } from 'axios';

export class TestClient {
  private readonly http: AxiosInstance;
  private accessToken: string | null = null;

  constructor(baseURL: string) {
    this.http = axios.create({ baseURL, timeout: 30000 });
  }

  get token(): string | null {
    return this.accessToken;
  }

  /**
   * Full auth flow using the dev-only sign-message endpoint.
   * 1. Generate nonce for address
   * 2. Sign the nonce via POST /auth/sign-message (dev only)
   * 3. Login with signed message to get JWT
   */
  async authenticate(address: string, privateKey: string): Promise<string> {
    const { data: nonceData } = await this.http.get(
      `/auth/generate-nonce/${address}`,
    );
    const nonce: string = nonceData.nonce;

    const { data: signData } = await this.http.post('/auth/sign-message', {
      pk: privateKey,
      message: nonce,
    });

    const { data: loginData } = await this.http.post('/auth/login', {
      address,
      signature: signData.signature,
    });

    this.accessToken = loginData.accessToken;
    return this.accessToken!;
  }

  private authHeaders() {
    if (!this.accessToken) return {};
    return { Authorization: `Bearer ${this.accessToken}` };
  }

  async get<T = any>(
    url: string,
    params?: Record<string, any>,
  ): Promise<AxiosResponse<T>> {
    return this.http.get<T>(url, { headers: this.authHeaders(), params });
  }

  async post<T = any>(url: string, data?: any): Promise<AxiosResponse<T>> {
    return this.http.post<T>(url, data, { headers: this.authHeaders() });
  }

  async patch<T = any>(url: string, data?: any): Promise<AxiosResponse<T>> {
    return this.http.patch<T>(url, data, { headers: this.authHeaders() });
  }

  async delete<T = any>(url: string): Promise<AxiosResponse<T>> {
    return this.http.delete<T>(url, { headers: this.authHeaders() });
  }

  /**
   * Get the blockchain ID for the local chain (Arbitrum Local).
   * Fetches from GET /blockchains and finds the one with the local chain name.
   */
  async getLocalBlockchainId(): Promise<string> {
    const { data: blockchains } = await this.http.get('/blockchains');
    const local = blockchains.find(
      (b: any) => b.name === 'Arbitrum Local' || b.chainId === 412346,
    );
    if (!local) {
      throw new Error(
        'Arbitrum Local blockchain not found. Is the backend running with ARB_LOCAL_ENABLED=true?',
      );
    }
    return local.id;
  }
}

/**
 * Poll a condition function until it returns true or the timeout expires.
 */
export async function waitForCondition(
  checkFn: () => Promise<boolean>,
  timeoutMs = 30000,
  intervalMs = 1000,
  description = 'condition',
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await checkFn()) return;
    } catch {
      // ignore errors during polling
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for: ${description} (${timeoutMs}ms)`);
}
