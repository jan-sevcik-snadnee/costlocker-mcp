interface CostlockerConfig {
  appName: string;
  apiToken: string;
  host: string;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

interface FetchOptions extends RequestInit {
  timeout?: number;
}

export interface UserInfo {
  person: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  company: {
    id: number;
    name: string;
  };
  authorization: string;
  [key: string]: unknown;
}

export class CostlockerClient {
  private config: CostlockerConfig;
  private cachedUserInfo: UserInfo | null = null;
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
  };

  constructor(config: CostlockerConfig) {
    this.config = config;
  }

  private get authHeader(): string {
    const credentials = `${this.config.appName}:${this.config.apiToken}`;
    const encoded = Buffer.from(credentials).toString('base64');
    return `Basic ${encoded}`;
  }

  private async fetchWithTimeout(url: string, options: FetchOptions = {}): Promise<Response> {
    const { timeout = 30000, ...fetchOptions } = options;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private shouldRetry(error: unknown): boolean {
    if (error instanceof TypeError && error.message.includes('fetch')) return true;
    if (error instanceof Error && error.name === 'AbortError') return true;
    if (error instanceof Response) {
      return error.status >= 500 || error.status === 429;
    }
    return false;
  }

  private formatError(error: unknown): string {
    if (error instanceof Error && error.name === 'AbortError') {
      return 'Request timeout - Costlocker API did not respond in time';
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return 'Network error - unable to reach Costlocker API';
    }
    if (error instanceof Error) return error.message;
    return String(error);
  }

  private async makeRequest<T>(
    url: string,
    options: FetchOptions = {},
    operation: string
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.authHeader,
            'User-Agent': 'CostlockerMCP/1.0.0',
            ...options.headers as Record<string, string>,
          },
          ...options,
        });

        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
            await this.sleep(retryAfter * 1000);
            continue;
          }

          let errorBody = '';
          try {
            errorBody = await response.text();
          } catch {
            // ignore
          }

          const statusMessages: Record<number, string> = {
            401: 'Invalid credentials. Check COSTLOCKER_APP_NAME and COSTLOCKER_API_TOKEN.',
            403: 'Insufficient permissions for this operation.',
            404: 'Resource not found.',
          };

          const sanitizedBody = errorBody && errorBody.length > 200
            ? errorBody.slice(0, 200) + '...'
            : errorBody;
          const message = statusMessages[response.status]
            || `HTTP ${response.status}: ${sanitizedBody || response.statusText}`;
          throw new Error(`${operation} failed: ${message}`);
        }

        return await response.json() as T;
      } catch (error) {
        lastError = error;

        if (error instanceof Error && error.message.includes('failed:')) {
          throw error;
        }

        if (attempt < this.retryConfig.maxRetries && this.shouldRetry(error)) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(2, attempt - 1),
            this.retryConfig.maxDelay
          );
          await this.sleep(delay);
          continue;
        }
      }
    }

    throw new Error(`${operation} failed: ${this.formatError(lastError)}`);
  }

  // --- User verification ---

  async verifyConnection(): Promise<UserInfo> {
    const data = await this.restGet<UserInfo>('/me');
    this.cachedUserInfo = data;
    return data;
  }

  getUserInfo(): UserInfo | null {
    return this.cachedUserInfo;
  }

  // --- Simple API v1 ---
  // POST to /api-public/v1/ with JSON body containing function names
  // Multiple functions can be batched in one request

  async simpleApi<T = unknown>(functions: Record<string, Record<string, unknown> | unknown[]>): Promise<T> {
    const url = `${this.config.host}/api-public/v1/`;
    return this.makeRequest<T>(url, {
      method: 'POST',
      body: JSON.stringify(functions),
    }, 'Simple API');
  }

  async simpleApiSingle<T = unknown>(functionName: string, params: Record<string, unknown> | unknown[] = {}): Promise<T> {
    const result = await this.simpleApi<Record<string, T>>({ [functionName]: params });
    return result[functionName];
  }

  // --- REST API v2 ---

  async restGet<T = unknown>(path: string): Promise<T> {
    const url = `${this.config.host}/api-public/v2${path}`;
    return this.makeRequest<T>(url, { method: 'GET' }, `GET ${path}`);
  }

  async restPost<T = unknown>(path: string, body: unknown): Promise<T> {
    const url = `${this.config.host}/api-public/v2${path}`;
    return this.makeRequest<T>(url, {
      method: 'POST',
      body: JSON.stringify(body),
    }, `POST ${path}`);
  }
}
