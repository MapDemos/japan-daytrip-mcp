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
  // Use the framework's reference Japan travel prompt
  // Call it with proper context binding so `this.i18n` works
  return ClaudeClient.prototype.buildJapanTravelPrompt.call(
    { i18n: context.i18n },
    context.userLocation,
    context.mapView
  );
}
