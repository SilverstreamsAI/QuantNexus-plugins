/**
 * Plugin API Client (TICKET_091)
 *
 * Simplified HTTP client for plugin-layer API calls.
 * CSP has been relaxed to allow plugins to access external HTTPS endpoints.
 *
 * @see TICKET_091 - Desktop CSP Relaxation
 */

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const API_BASE_URL = 'https://desktop-api.silvonastream.com';
const DEFAULT_TIMEOUT = 120000; // 2 minutes
const DEFAULT_POLL_INTERVAL = 500; // 500ms
const DEFAULT_POLL_TIMEOUT = 180000; // 3 minutes

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ApiResponse {
  success: boolean;
  data?: {
    task_id?: string;
    status?: string;
    result?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export interface PollOptions<T> {
  initialData: unknown;
  startEndpoint: string;
  pollEndpoint: string;
  pollInterval?: number;
  timeout?: number;
  handlePollResponse: (response: unknown) => {
    isComplete: boolean;
    result?: T;
    rawResponse: unknown;
  };
}

// -----------------------------------------------------------------------------
// Logger
// -----------------------------------------------------------------------------

const log = {
  debug: (msg: string) => console.debug(`[Plugin][API] ${msg}`),
  info: (msg: string) => console.info(`[Plugin][API] ${msg}`),
  error: (msg: string) => console.error(`[Plugin][API] ${msg}`),
};

// -----------------------------------------------------------------------------
// API Client
// -----------------------------------------------------------------------------

class PluginApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = API_BASE_URL, timeout: number = DEFAULT_TIMEOUT) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * Make HTTP request (TICKET_184: JWT Token Injection)
   */
  private async request<T extends ApiResponse>(
    endpoint: string,
    options: RequestInit = {},
    isRetry: boolean = false
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    log.info(`Request: ${options.method || 'GET'} ${url}`);

    // TICKET_184: Get access token from Main Process via IPC
    // TICKET_201: Enhanced logging for auth debugging
    let accessToken: string | null = null;
    try {
      log.debug('getAccessToken: calling IPC...');
      const tokenResult = await window.electronAPI?.auth?.getAccessToken();
      log.debug(
        `getAccessToken: success=${tokenResult?.success}, hasData=${!!tokenResult?.data}`
      );
      if (tokenResult?.success && tokenResult.data) {
        accessToken = tokenResult.data;
      }
    } catch (err) {
      log.error(`getAccessToken: IPC call failed - ${err}`);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Client-Type': 'desktop',
    };

    // Merge custom headers
    if (options.headers) {
      const customHeaders = options.headers as Record<string, string>;
      Object.assign(headers, customHeaders);
    }

    // TICKET_184: Require login for all API requests
    // TICKET_201: Show user-friendly modal before throwing
    if (!accessToken) {
      log.error('No access token - login required');

      // TICKET_201: Show modal notification to user
      if (globalThis.nexus?.window?.showAlert) {
        // Non-blocking - show modal but don't await
        globalThis.nexus.window.showAlert(
          'Please log in to continue. Click the "Login / Sign Up" button in the top right corner.',
          { title: 'Login Required' }
        );
      }

      // TICKET_201: Dispatch event for Host layer to handle (optional login trigger)
      window.dispatchEvent(
        new CustomEvent('nexus:auth-required', {
          detail: { message: 'Login required', action: 'login' },
        })
      );

      throw new Error('AUTH_REQUIRED');
    }

    headers['Authorization'] = `Bearer ${accessToken}`;
    log.debug('Authorization header injected');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers,
      });

      clearTimeout(timeoutId);

      // TICKET_184: Handle 401 - trigger token refresh and retry once
      if (response.status === 401 && !isRetry && window.electronAPI?.auth?.refresh) {
        log.info('401 received, attempting token refresh');
        const refreshResult = await window.electronAPI.auth.refresh();
        if (refreshResult?.success) {
          log.info('Token refreshed, retrying request');
          return this.request<T>(endpoint, options, true);
        }
        log.error('Token refresh failed');
      }

      const serverResponse = await response.json();
      log.debug(`Response: ${response.status}`);
      return serverResponse as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        log.error(`Request timeout: ${url}`);
        return {
          success: false,
          data: {
            status: 'failed',
            result: { error: { code: 'TIMEOUT', message: 'Request timed out' } },
          },
        } as unknown as T;
      }

      log.error(`Request error: ${error instanceof Error ? error.message : 'Unknown'}`);
      return {
        success: false,
        data: {
          status: 'failed',
          result: { error: { code: 'NETWORK_ERROR', message: String(error) } },
        },
      } as unknown as T;
    }
  }

  async post<T extends ApiResponse>(endpoint: string, body?: unknown): Promise<T> {
    // TICKET_260: Log full request payload for debugging
    if (body) {
      const bodyStr = JSON.stringify(body, null, 2);
      log.info(`Request payload:\n${bodyStr}`);
    }
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Execute long-running task with polling
   */
  async executeWithPolling<T>(options: PollOptions<T>): Promise<T> {
    const {
      initialData,
      startEndpoint,
      pollEndpoint,
      pollInterval = DEFAULT_POLL_INTERVAL,
      timeout = DEFAULT_POLL_TIMEOUT,
      handlePollResponse,
    } = options;

    // 1. Start task
    log.info(`Starting task: ${startEndpoint}`);
    const startResponse = await this.post<ApiResponse>(startEndpoint, initialData);

    // Debug: Log start response
    log.debug(`Start response: success=${startResponse.success}`);
    log.debug(`Start response data: ${JSON.stringify(startResponse.data || {}).substring(0, 1000)}`);

    if (!startResponse.success) {
      const resultData = startResponse.data?.result as Record<string, unknown> | undefined;
      const err = resultData?.error as { error_code?: string; error_message?: string; message?: string } | undefined;

      // Log full error structure for debugging
      log.error(`Start failed - Full result: ${JSON.stringify(resultData || {})}`);

      // Create detailed error with reason_code if available
      const reasonCode = resultData?.reason_code as string | undefined;
      const errorCode = err?.error_code || reasonCode;
      const errorMessage = err?.error_message || err?.message || 'Failed to start task';

      // Throw error with both code and message for upstream handling
      const error = new Error(errorMessage);
      (error as Error & { code?: string; reasonCode?: string }).code = errorCode;
      (error as Error & { code?: string; reasonCode?: string }).reasonCode = reasonCode;
      throw error;
    }

    // TICKET_208: Support both response formats
    // Format 1: { success: true, data: { task_id: "..." } } (regime APIs)
    // Format 2: { success: true, task_id: "..." } (kronos APIs)
    const taskId = startResponse.data?.task_id ||
      (startResponse as unknown as { task_id?: string }).task_id;
    if (!taskId) {
      throw new Error('No task_id returned from server');
    }

    log.info(`Task started: ${taskId}`);

    // 2. Poll for completion
    const startTime = Date.now();
    let pollCount = 0;

    while (Date.now() - startTime < timeout) {
      pollCount++;
      log.debug(`Polling (${pollCount}): ${taskId}`);

      const pollResponse = await this.post<ApiResponse>(pollEndpoint, { task_id: taskId });

      // Debug: Log full poll response
      log.debug(`Poll response: success=${pollResponse.success}, status=${pollResponse.data?.status}`);
      log.debug(`Poll result: ${JSON.stringify(pollResponse.data?.result || {}).substring(0, 500)}`);

      if (!pollResponse.success) {
        const err = pollResponse.data?.result as { error?: { message?: string } } | undefined;
        log.error(`Poll failed: ${JSON.stringify(err)}`);
        throw new Error(err?.error?.message || 'Poll request failed');
      }

      const status = pollResponse.data?.status;

      // Let handlePollResponse process the response first (including failed/rejected status)
      const result = handlePollResponse(pollResponse);
      log.debug(`handlePollResponse: isComplete=${result.isComplete}, resultStatus=${(result.result as { status?: string })?.status}`);

      if (result.isComplete) {
        if (result.result === undefined) {
          throw new Error('Task completed but no result returned');
        }
        log.info(`Task completed: ${taskId}`);
        return result.result;
      }

      await this.delay(pollInterval);
    }

    throw new Error(`Task timeout after ${timeout}ms`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const pluginApiClient = new PluginApiClient();
