import { createCorsair } from "corsair";
import {
  ExecuteRequestPayload,
  IntegrationCredentials,
} from "../types/index.js";
import { getPluginFactory } from "../plugins/index.js";

/**
 * Service responsible for statelessly executing Corsair plugins.
 */
export class ExecutionService {
  /**
   * Executes a requested tool statelessly, mapping credentials to the target plugin.
   * * @param payload - The execution request details from the orchestrator body.
   * @param credentials - The decoded credentials dictionary from the HTTP header.
   * @returns The raw data returned from the third-party API.
   */
  public static async executeAction(
    payload: ExecuteRequestPayload,
    credentials: IntegrationCredentials,
  ): Promise<any> {
    const { integration, tool, args = {}, isApproved = false } = payload;

    // 1. Fetch the correct plugin factory and instantiate it
    const pluginFactory = getPluginFactory(integration);
    const plugin = pluginFactory(credentials, isApproved);

    // 2. Boot the isolated Corsair context
    const dynamicCorsair = createCorsair({
      plugins: [plugin],
      database: undefined, // Enforces 100% stateless execution
      multiTenancy: false,
      kek: "4Ep5doYkrb96Vh7EEQQghYyFsdR/5oFSo7ix04JVqQw=",
    });

    // 3. Traverse the API tree to resolve the tool function
    const parts = tool.split(".");
    let current = (dynamicCorsair as any)[integration]?.api;
    let parent = (dynamicCorsair as any)[integration];

    if (!current) {
      throw new Error(
        `Integration API '${integration}' not initialized in Corsair context.`,
      );
    }

    for (const part of parts) {
      if (!current[part]) {
        throw new Error(`Tool path '${tool}' is invalid for '${integration}'.`);
      }
      parent = current;
      current = current[part];
    }

    if (typeof current !== "function") {
      throw new Error(`Resolved path '${tool}' is not an executable function.`);
    }

    // Bind the final function to its parent to preserve execution context
    return await current.bind(parent)(args);
  }

  /**
   * Performs a lightweight check to verify if the provided credentials format is structurally valid.
   * * @param integration - The target integration identifier.
   * @param credentials - The credential dictionary to validate.
   * @returns True if initialization passes, false otherwise.
   */
  public static async validateCredentials(
    integration: string,
    credentials: IntegrationCredentials,
  ): Promise<boolean> {
    try {
      const factory = getPluginFactory(integration);
      factory(credentials, false);
      return true;
    } catch (error) {
      return false;
    }
  }
}
