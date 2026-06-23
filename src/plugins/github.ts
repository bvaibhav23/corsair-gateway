import { github } from '@corsair-dev/github';

/**
 * Creates a stateless, highly-scoped GitHub plugin instance.
 * @param token - The decrypted BYOK access token.
 * @param isApproved - If true, bypasses strict mode to execute a human-approved write action.
 * @returns An initialized Corsair GitHub plugin with a patched KeyBuilder.
 */
export const createGithubPlugin = (token: string, isApproved: boolean = false) => {
  const plugin = github({
    authType: 'api_key',
    credentials: { token },
    // If C# signals approval, we drop strict mode. Otherwise, we enforce it defensively.
    permissions: isApproved ? undefined : { mode: 'strict' }
  });

  // CRITICAL BYPASS: Force Corsair to use the injected token in memory, ignoring the database.
  plugin.keyBuilder = async (ctx: any) => {
    return ctx?.options?.credentials?.token ?? token;
  };

  return plugin;
};