/**
 * Japan Travel Expert System Prompt Builder
 *
 * Domain-specific system prompt for the Japan Tourism demo.
 * This prompt configures Claude to act as "Kenji", a Japan travel expert.
 *
 * The full 500+ line prompt is preserved in the framework's ClaudeClient
 * class as a reference implementation. This builder delegates to that method.
 */

import { ClaudeClient } from '@mapdemos/ai-framework/ai';

export function buildJapanTravelPrompt(context) {
  // Validate context
  if (!context || !context.i18n) {
    console.error('[buildJapanTravelPrompt] Invalid context:', context);
    throw new Error('buildJapanTravelPrompt: context.i18n is required');
  }

  // Use the framework's reference Japan travel prompt
  // Pass the entire context as `this` so the method can access this.i18n
  return ClaudeClient.prototype.buildJapanTravelPrompt.call(
    context,
    context.userLocation,
    context.mapView
  );
}
