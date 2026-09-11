/** OneJarc frontend snapshot from company-tool-hub/hooks/use-submission.ts.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
'use client';
/** Form state machine: guard double submits synchronously, retain inputs on
 * failure, and display success only after the awaited service operation. */
import { useRef, useState } from 'react';
import { ApiError, describeApiError } from '@/models/api-client';
import { backendConfig } from '@/models/backend-config';
export function useSubmission() {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run<T>(operation: () => Promise<T>): Promise<T | undefined> {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      return await operation();
    } catch (failure) {
      setError(
        failure instanceof ApiError || backendConfig.dataSource === 'api'
          ? describeApiError(failure)
          : failure instanceof Error
            ? failure.message
            : 'Could not save. Please try again.',
      );
      return undefined;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return { busy, error, run };
}
