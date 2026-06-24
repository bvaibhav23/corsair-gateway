# 🔌 Provider Architecture

This directory houses the concrete implementations of execution engines. The
Aventisia Connector Execution Service (CES) is not tied to a single framework;
it uses the `IProvider` interface to abstract away the underlying execution
logic.

## The `IProvider` Contract

Every provider must implement the `IProvider` interface found in
`src/interfaces/IProvider.ts`.

A provider is responsible for two domains:

1. **Discovery:** Translating its internal tool definitions into Aventisia's UI
   formats and standard LLM JSON schemas.
2. **Execution:** Taking a raw payload and an injected credential dictionary,
   booting its environment, and returning a result.

## How to Add a New Provider (e.g., MCP)

### Step 1: Create the Implementation

Create `src/providers/McpProvider.ts` and implement the interface:

```typescript
import { IProvider } from "../interfaces/IProvider.js";
import {
  ExecuteRequestPayload,
  IntegrationCredentials,
} from "../types/index.js";

export class McpProvider implements IProvider {
  public getManifest(integrationId: string) {
    // Logic to query the MCP server for available tools
  }

  public getLlmSchema(integrationId: string, tool: string) {
    // Logic to format MCP tool arguments into OpenAPI3 schemas
  }

  public getUiConfig(integrationId: string, tool: string) {
    // Logic to map MCP parameters to Aventisia UI JSON fields
  }

  public async executeAction(
    payload: ExecuteRequestPayload,
    credentials: IntegrationCredentials,
  ) {
    // Logic to establish an MCP JSON-RPC connection and execute the tool statelessly
  }

  public async validateCredentials(
    integrationId: string,
    credentials: IntegrationCredentials,
  ) {
    // Logic to ping the MCP server
    return true;
  }
}
```

### Step 2: Register the Provider

Open `src/registry/ProviderRegistry.ts` and map your new provider.

```typescript
import { McpProvider } from "../providers/McpProvider.js";

export class ProviderRegistry {
  private static providers: Map<string, IProvider> = new Map();

  static {
    this.providers.set("corsair", new CorsairProvider());
    this.providers.set("mcp", new McpProvider());
  }

  public static getProvider(integrationId: string): IProvider {
    return this.providers.get("corsair");
  }
}
```
