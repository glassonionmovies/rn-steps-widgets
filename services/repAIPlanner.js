// services/repAIPlanner.js
// Compat shim so legacy callers using `repAIPlanner.generatedPlan(...)` keep working.
// It defers to the new utils module and returns the normalized plan.

import * as planner from '../utils/repAiPlanner'; // NOTE: exact casing: repAiPlanner

/**
 * Legacy entry: returns normalized plan (not wrapped).
 * Usage: const plan = await repAIPlanner.generatedPlan(args)
 */
export async function generatedPlan(args) {
  if (planner && typeof planner.generatedPlan === 'function') {
    return await planner.generatedPlan(args);
  }
  if (planner && typeof planner.generatePlanWithHistory === 'function') {
    const { plan } = await planner.generatePlanWithHistory(args);
    return plan;
  }
  throw new Error('repAiPlanner: no compatible generator found');
}

// Keep a default export for consumers that do default import
const api = { generatedPlan };
export default api;

// CommonJS interop for require()
try {
  // eslint-disable-next-line no-undef
  if (typeof module !== 'undefined' && module.exports) {
    // eslint-disable-next-line no-undef
    module.exports = api;
    // eslint-disable-next-line no-undef
    module.exports.generatedPlan = generatedPlan;
    // eslint-disable-next-line no-undef
    module.exports.default = api;
  }
} catch {}

