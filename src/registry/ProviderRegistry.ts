import { IProvider } from "../interfaces/IProvider.js";
import { CorsairProvider } from "../providers/CorsairProvider.js";

export class ProviderRegistry {
  private static providers: Map<string, IProvider> = new Map();

  static {
    // Register Corsair as the default engine for standard web plugins
    const corsairProvider = new CorsairProvider();
    this.providers.set("corsair", corsairProvider);

    // Future: this.providers.set("mcp", new McpProvider());
  }

  /**
   * Determines which provider handles the given integration.
   */
  public static getProvider(integrationId: string): IProvider {
    // In the future, you could check an IntegrationMetadata flag like `engine: 'mcp'`
    // For now, everything defaults to Corsair.
    const provider = this.providers.get("corsair");
    if (!provider) {
      throw new Error("Critical: Default Corsair provider is not registered.");
    }
    return provider;
  }
}
