/**
 * HTTP client for the Diamond IQ backend.
 *
 * Thin wrapper over `fetch` that:
 *   - prefixes every URL with `API_URL`
 *   - applies a 5s timeout via `AbortSignal.timeout`
 *   - throws a typed `ApiError` for any non-2xx, network failure, or timeout
 *   - returns the parsed JSON body on success
 *
 * Response shapes match the backend's `game_to_api_response` exactly
 * (snake_case, integer game_pk, scores at top level, linescore nested).
 */

import { API_URL } from './env';
import type {
  ApiContentResponse,
  ApiErrorBody,
  GameDetailResponse,
  ScoreboardResponse,
} from '@/types/api';

const DEFAULT_TIMEOUT_MS = 5000;

export class ApiError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(message: string, opts: { status: number; url: string; cause?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.url = opts.url;
    if (opts.cause !== undefined) {
      (this as { cause?: unknown }).cause = opts.cause;
    }
  }
}

// ── Public client ───────────────────────────────────────────────────────

interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = `${API_URL}${path}`;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const signal = opts.signal ?? AbortSignal.timeout(timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    // AbortError on timeout, TypeError on network failure (DNS, offline, etc.)
    const isTimeout =
      err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError');
    throw new ApiError(isTimeout ? `Request timed out after ${timeoutMs}ms: ${url}` : `Network error: ${url}`, {
      status: 0,
      url,
      cause: err,
    });
  }

  if (!response.ok) {
    let bodyMessage = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as Partial<ApiErrorBody>;
      if (body?.error?.message) bodyMessage = body.error.message;
    } catch {
      // body wasn't JSON; keep the status text
    }
    throw new ApiError(bodyMessage, { status: response.status, url });
  }

  return (await response.json()) as T;
}

/** Fetch the scoreboard for one date (YYYY-MM-DD). Defaults to UTC today server-side. */
export function fetchScoreboard(
  date?: string,
  opts: RequestOptions = {},
): Promise<ScoreboardResponse> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return request<ScoreboardResponse>(`/scoreboard/today${query}`, opts);
}

/** Fetch a single game by its MLB gamePk. Date is required (no GSI yet). */
export function fetchGame(
  gameId: number,
  date: string,
  opts: RequestOptions = {},
): Promise<GameDetailResponse> {
  const query = `?date=${encodeURIComponent(date)}`;
  return request<GameDetailResponse>(`/games/${encodeURIComponent(String(gameId))}${query}`, opts);
}

/** Fetch the day's AI-generated recap, previews, and featured matchups. */
export function fetchDailyContent(
  date?: string,
  opts: RequestOptions = {},
): Promise<ApiContentResponse> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return request<ApiContentResponse>(`/content/today${query}`, opts);
}
