import { github } from "@corsair-dev/github";
import { IntegrationCredentials } from "../types/index.js";

/**
 * Creates a stateless, highly-scoped GitHub plugin instance.
 * @param credentials - A dictionary expected to contain { token: string }.
 * @param isApproved - If true, bypasses strict mode to execute a human-approved write action.
 * @returns An initialized Corsair GitHub plugin with a patched KeyBuilder.
 */
export const createGithubPlugin = (
  credentials: IntegrationCredentials,
  isApproved: boolean = false,
) => {
  const plugin = github({
    authType: "api_key",
    credentials: {
      // Fulfills Corsair's initialization validation schema
      token: credentials.token,
    },
    // If C# signals approval, drop strict mode. Otherwise, enforce it defensively.
    permissions: isApproved ? undefined : { mode: "strict" },
  });

  /**
   * CRITICAL BYPASS: Force Corsair to use the injected token in memory.
   * This prevents the framework from attempting to look up the user's connection
   * in its internal, database-backed Key Management System.
   */
  plugin.keyBuilder = async () => {
    return credentials.token;
  };

  return plugin;
};
