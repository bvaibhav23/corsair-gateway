### Step 1: Install the Corsair Plugin

First, you need to add the official Outlook package from Corsair to your sidecar. Run this command in your aventisia-gateway folder:

Bash
`   npm install @corsair-dev/outlook   `

### Step 2: Create the Outlook Factory

Next, you'll create a new file specifically for configuring the Outlook plugin. Because Microsoft Graph (which Outlook uses) relies on OAuth2, the configuration is slightly different from the api\_key setup we used for GitHub.

Create a new file at **src/plugins/outlook.ts** and add the following code:

TypeScript

`   import { outlook } from '@corsair-dev/outlook';  /**   * Creates a stateless, highly-scoped Outlook plugin instance.   * @param token - The decrypted Microsoft Graph / Outlook access token from the C# vault.   * @param isApproved - If true, bypasses strict mode to execute a human-approved write action.   */  export const createOutlookPlugin = (token: string, isApproved: boolean = false) => {    const plugin = outlook({      authType: 'oauth_2', // Outlook generally uses OAuth2 access tokens      credentials: {         access_token: token       },      // Enforce Human-in-the-Loop for destructive actions      permissions: isApproved ? undefined : { mode: 'strict' }    });    // CRITICAL BYPASS: Force Corsair to use the injected C# token in memory.    plugin.keyBuilder = async (ctx: any) => {      return ctx?.options?.credentials?.access_token ?? token;    };    return plugin;  };   `

### Step 3: Register the Plugin

Now, you must register the newly created Outlook plugin so the ExecutionService knows how to route to it.

Open your existing **src/plugins/index.ts** file and update it:

TypeScript

``   import { createGithubPlugin } from './github';  import { createOutlookPlugin } from './outlook'; // 1. Import the Outlook factory  type PluginFactory = (token: string, isApproved?: boolean) => any;  export const PluginRegistry: Record = {    github: createGithubPlugin,    outlook: createOutlookPlugin, // 2. Register it here  };  export function getPluginFactory(integration: string): PluginFactory {    const factory = PluginRegistry[integration];    if (!factory) {      throw new Error(`Unsupported integration: '${integration}'.`);    }    return factory;  }   ``

### Step 4: Testing the Integration

With these changes, the Node.js sidecar is ready to accept Outlook tool calls. Your C# orchestrator simply needs to send payloads targeting the "outlook" integration.

Here is an example payload you can test in Thunder Client (ensure you have a valid Microsoft access token):

**POST http://localhost:3000/api/execute**

JSON

`   {    "integration": "outlook",    "tool": "mail.list",    "token": "eyJ0eXAiOiJKV1Qi...",     "args": {      "folderId": "inbox",      "top": 5    }  }   `

This modular approach ensures that adding Outlook (or any future plugin like Slack or Jira) requires no changes to the core execution logic or Express routing.