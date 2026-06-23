import { outlook } from "@corsair-dev/outlook";

/**
 * Creates a stateless, highly-scoped Outlook plugin instance.
 * @param token - The decrypted Microsoft Graph / Outlook access token from the C# vault.
 * @param isApproved - If true, bypasses strict mode to execute a human-approved write action.
 */
export const createOutlookPlugin = (
    token: string,
    isApproved: boolean = false,
) => {
    
    const plugin = outlook({
        authType: "oauth_2", // Outlook generally uses OAuth2 access tokens

        credentials: {

            key: token
        },
        // Enforce Human-in-the-Loop for destructive actions
        permissions: isApproved ? undefined : { mode: "strict" },
    });

    // CRITICAL BYPASS: Force Corsair to use the injected C# token in memory.
    plugin.keyBuilder = async (ctx: any) => {
        return ctx?.options?.credentials?.access_token ?? token;
    };

    return plugin;
};
