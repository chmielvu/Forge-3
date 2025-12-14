
export interface RetryConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: any) => boolean;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelay: 2000,
  maxDelay: 16000,
  shouldRetry: (error: any) => error.status === 429 || error.status === 503
};

export async function callWithRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay, shouldRetry } = { ...DEFAULT_CONFIG, ...config };
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if we should retry
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }
      
      // Calculate exponential backoff with jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      );
      
      console.warn(
        `[Retry] Attempt ${attempt + 1}/${maxRetries + 1} failed. ` +
        `Retrying in ${delay}ms...`,
        error.message || error
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Specialized wrapper for Gemini API calls
export async function callGeminiWithRetry<T>(
  fn: () => Promise<T>,
  context: string = 'API Call'
): Promise<T> {
  return callWithRetry(fn, {
    maxRetries: 3,
    baseDelay: 2000,
    shouldRetry: (error: any) => {
      // Retry on rate limits and server errors
      if (error.status === 429) {
        console.warn(`[${context}] Rate limited`);
        return true;
      }
      if (error.status === 503) {
        console.warn(`[${context}] Service unavailable`);
        return true;
      }
      // Don't retry on safety/auth errors
      if (error.status === 400 || error.status === 401 || error.status === 403) {
        return false;
      }
      return false;
    }
  });
}
