/**
 * Server-Side Error Tracker Stub
 *
 * This provides a dummy/stub implementation of the errorTracker
 * for use in server-side environments (like Netlify functions) where the
 * full, browser-based error tracker cannot be used.
 */

import { logger } from './logger';

export const errorTracker = {
  trackError: async (error: Error, context: any = {}): Promise<void> => {
    logger.error(`[SERVER STUB] Error tracked: ${error.message}`, {
      component: context.component || 'server-stub',
      action: context.action || 'error-tracked',
      correlationId: context.correlationId,
      metadata: {
        errorName: error.name,
        ...context.metadata,
      },
    });
    // In a real scenario, you might want to send this to a proper
    // server-side error tracking service (@sentry/node, etc.).
    // For now, we just log it to avoid breaking the build.
    return Promise.resolve();
  },
};
