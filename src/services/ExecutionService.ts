import { createCorsair } from "corsair";
import { getPluginFactory } from "../plugins";
import { ExecuteRequestPayload } from "../types";

export class ExecutionService {
  /**
   * Dynamically traverses the Corsair API tree to find the executable function.
   * @param corsairInstance - The active Corsair runtime context.
   * @param integration - The root integration name (e.g., 'github').
   * @param toolPath - The dot-notation path to resolve (e.g., 'issues.create').
   * @returns A bound, executable function ready to receive arguments.
   */
  private static resolveToolMethod(
    corsairInstance: any,
    integration: string,
    toolPath: string,
  ): Function {
    const parts = toolPath.split(".");
    let current = corsairInstance[integration]?.api;
    let parent = corsairInstance[integration];

    if (!current) {
      throw new Error(
        `Integration API '${integration}' not initialized in Corsair context.`,
      );
    }

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!current[part]) {
        throw new Error(
          `Tool path '${toolPath}' is invalid for '${integration}'.`,
        );
      }
      parent = current;
      current = current[part];
    }

    if (typeof current !== "function") {
      throw new Error(
        `Resolved path '${toolPath}' is not an executable function.`,
      );
    }

    return current.bind(parent);
  }

  /**
   * Executes a requested tool statelessly.
   * @param payload - The execution request details from the orchestrator.
   * @returns The raw data returned from the third-party API.
   */
  public static async executeAction(
    payload: ExecuteRequestPayload,
  ): Promise<any> {
    const { integration, tool, args = {}, token, isApproved = false } = payload;

    // 1. Fetch the correct plugin factory and instantiate it
    const pluginFactory = getPluginFactory(integration);
    const plugin = pluginFactory(token, isApproved);

    // 2. Boot the isolated Corsair context (Strictly Database-Free)
    const dynamicCorsair = createCorsair({
      plugins: [plugin],
      database: undefined, // Enforces 100% stateless execution
      multiTenancy: false,
      kek: "4Ep5doYkrb96Vh7EEQQghYyFsdR/5oFSo7ix04JVqQw=",
    });

  console.log(dynamicCorsair.github.api)
    // 3. Resolve the tool from the SDK and execute
    const executableTool = this.resolveToolMethod(
      dynamicCorsair,
      integration,
      tool,
    );
    return await executableTool(args);
  }
}
