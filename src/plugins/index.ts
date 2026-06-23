import { createGithubPlugin } from './github';
import { createOutlookPlugin } from './outlook';

/**
 * Type definition for a dynamic plugin factory function.
 */
type PluginFactory = (token: string, isApproved?: boolean) => any;

/**
 * Central registry for all supported integrations.
 * To scale the application, register new integrations here.
 */
export const PluginRegistry: Record<string, PluginFactory> = {
  github: createGithubPlugin,
  outlook: createOutlookPlugin,
  // slack: createSlackPlugin,
  // jira: createJiraPlugin,
};

/**
 * Retrieves the appropriate plugin factory based on the integration name.
 * @param integration - The name of the integration.
 * @throws Error if the integration is unsupported.
 * @returns The requested PluginFactory.
 */
export function getPluginFactory(integration: string): PluginFactory {
  const factory = PluginRegistry[integration];
  if (!factory) {
    throw new Error(`Unsupported integration: '${integration}'.`);
  }
  return factory;
}