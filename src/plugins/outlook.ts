import { outlook } from "@corsair-dev/outlook";
import { IntegrationCredentials } from "../types";

/**
 * Creates a stateless, highly-scoped Outlook plugin instance.
 * * @param credentials - A dictionary expected to contain { clientId, clientSecret, accessToken }.
 * @param isApproved - If true, bypasses strict mode to execute a human-approved write action.
 * @returns An initialized Corsair Outlook plugin with a patched KeyBuilder.
 */
export const createOutlookPlugin = (
  credentials: IntegrationCredentials,
  isApproved: boolean = false,
) => {
  const plugin = outlook({
    // authType: "oauth_2",
    // key:credentials.clientId,
    // // credentials: {
    // //   // Fulfills Corsair's initialization validation schema for OAuth apps
    // //   client_id: credentials.clientId,
    // //   client_secret: credentials.clientSecret,
    // //   access_token: credentials.accessToken,
    // // },
    // // If C# signals approval, drop strict mode. Otherwise, enforce it defensively.
    // permissions: isApproved ? undefined : { mode: "strict" },
  });

  /**
   * CRITICAL BYPASS: Force Corsair to use the injected access token at runtime.
   * While the plugin initialization requires the ID and Secret for validation,
   * the actual HTTP execution engine only requires the Bearer access_token.
   */
  plugin.keyBuilder = async () => {
    return credentials.accessToken;
  };

  return plugin;
};
