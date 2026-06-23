import { IntegrationCredentials } from "../types";
import { createGithubPlugin } from "./github";
import { createOutlookPlugin } from "./outlook";

/**
 * Type definition for a dynamic plugin factory function.
 * Every plugin factory must accept the unified credentials dictionary.
 */
type PluginFactory = (
  credentials: IntegrationCredentials,
  isApproved?: boolean,
) => any;

/**
 * Central registry for all supported integrations.
 * To scale the application, register new integration factories here.
 */
export const PluginRegistry: Record<string, PluginFactory> = {
  github: createGithubPlugin,
  outlook: createOutlookPlugin,
};

/**
 * Retrieves the appropriate plugin factory based on the integration name.
 * * @param integration - The name of the integration (e.g., 'github').
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
