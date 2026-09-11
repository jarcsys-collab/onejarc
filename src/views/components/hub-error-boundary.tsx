/** OneJarc frontend snapshot from company-tool-hub/components/hub-error-boundary.tsx.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/views/components/ui/button';

/**
 * Recover from a render error without leaving employees on the platform error
 * screen. Retrying remounts the app and restores valid device-local preferences.
 * Event-handler and storage errors are handled at their respective call sites.
 */
export class HubErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean; attempt: number }
> {
  state = { failed: false, attempt: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed)
      return (
        <main className="grid min-h-svh place-items-center bg-background p-6 text-foreground">
          <section
            role="alert"
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6"
          >
            <AlertTriangle className="mb-4 size-6 text-hub-warning" />
            <p className="text-xs font-semibold tracking-widest text-primary">
              ONEJARC
            </p>
            <h1 className="mt-2 text-2xl font-semibold">
              Let’s get your workspace back.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Something interrupted this view. Retry to restore your saved
              preferences. Unsaved form entries may be lost.
            </p>
            <Button
              className="mt-5 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() =>
                this.setState((state) => ({
                  failed: false,
                  attempt: state.attempt + 1,
                }))
              }
            >
              Retry workspace
            </Button>
          </section>
        </main>
      );
    return (
      <div key={this.state.attempt} className="contents">
        {this.props.children}
      </div>
    );
  }
}
