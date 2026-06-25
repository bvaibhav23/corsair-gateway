import { createCorsair } from "corsair";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getPluginFactory } from "../plugins/index.js";
import { IntegrationMetadataRegistry } from "../metadata/IntegrationMetadata.js";

/**
 * Service responsible for crawling Corsair plugins to generate Manifests, LLM Schemas, and UI Configs.
 */
export class DiscoveryService {
  /**
   * Provides dummy credentials for statelessly instantiating plugins during discovery.
   */
  private static getDummyCredentials() {
    return {
      token: "dummy",
      clientId: "dummy",
      clientSecret: "dummy",
      accessToken: "dummy",
    };
  }

  /**
   * Retrieves the raw, unwrapped plugin. Required because Corsair strips metadata during wrapping.
   */
  private static getRawPlugin(integration: string) {
    const factory = getPluginFactory(integration);
    return factory(this.getDummyCredentials(), false);
  }

  /**
   * Instantiates a temporary Corsair instance solely to read the executable API tree paths.
   */
  private static getDummyCorsairContext(integration: string) {
    const plugin = this.getRawPlugin(integration);
    return createCorsair({
      plugins: [plugin],
      database: undefined,
      multiTenancy: false,
      kek: "",
    });
  }

  /**
   * Recursively extracts all available tool paths from a nested API object.
   */
  private static extractToolPaths(
    apiObject: any,
    currentPath: string = "",
  ): string[] {
    let availablePaths: string[] = [];
    for (const key of Object.keys(apiObject)) {
      const value = apiObject[key];
      const newPath = currentPath ? `${currentPath}.${key}` : key;

      if (typeof value === "function") {
        availablePaths.push(newPath);
      } else if (typeof value === "object" && value !== null) {
        availablePaths = availablePaths.concat(
          this.extractToolPaths(value, newPath),
        );
      }
    }
    return availablePaths;
  }

  /**
   * Converts a dot-notation tool path into an array of PascalCase words.
   * Example: "pullRequests.list" -> ["Pull", "Requests", "List"]
   */
  private static formatToolPath(toolPath: string): string[] {
    return toolPath
      .split(".")
      .flatMap((segment) => segment.split(/(?=[A-Z])/))
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  }

  /**
   * Centralized metadata extractor to ensure descriptions remain consistent across all outputs.
   */
  private static getToolMetadata(
    rawPlugin: any,
    tool: string,
    fallbackLabel: string,
  ) {
    let description = `Execute the ${tool} action via the ${fallbackLabel} integration.`;

    // Check standard API actions
    if (rawPlugin?.endpointMeta?.[tool]) {
      description =
        rawPlugin.endpointMeta[tool].description ||
        rawPlugin.endpointMeta[tool].summary ||
        description;
    }
    // Check webhook subscriptions or actions
    else if (rawPlugin?.webhookSchemas?.[tool]) {
      description = rawPlugin.webhookSchemas[tool].description || description;
    }

    return { description };
  }

  /**
   * Generates the structured UI Manifest required for the Aventisia workflow builder action selector.
   */
  public static getAppIntegrationsManifest(): any {
    const actionCategories = [];

    for (const integrationId of Object.keys(IntegrationMetadataRegistry)) {
      const metadata = IntegrationMetadataRegistry[integrationId];

      try {
        const corsairInstance = this.getDummyCorsairContext(integrationId);
        const apiTree = (corsairInstance as any)[integrationId]?.api;

        if (!apiTree) continue;

        const rawPlugin = this.getRawPlugin(integrationId);
        const toolPaths = this.extractToolPaths(apiTree);

        const actions = toolPaths.map((toolPath) => {
          const { description } = this.getToolMetadata(
            rawPlugin,
            toolPath,
            metadata.label,
          );
          const pascalCaseWords = this.formatToolPath(toolPath);

          return {
            type: "corsairNode",
            name: pascalCaseWords.join(""),
            label: pascalCaseWords.join(" "),
            description: description,
            docsLink: "https://docs.aventisia.com",
            img: metadata.img,
            supportedPlatforms: ["cloud", "windows"],
            _routingConfig: {
              integration: integrationId,
              tool: toolPath,
            },
          };
        });

        actionCategories.push({
          label: metadata.label,
          description: metadata.description,
          icon: null,
          img: metadata.img,
          listType: null,
          actions: actions,
        });
      } catch (error) {
        console.warn(
          `Failed to generate manifest for integration: ${integrationId}`,
          error,
        );
      }
    }

    return [
      {
        label: "Data Transformations",
        description: "Clean, transform, and structure your data with ease",
        icon: null,
        img: null,
        actionCategories: [],
      },
      {
        label: "UI Interface Automations",
        description:
          "Automate your desktop with actions that mimic user interactions",
        icon: null,
        img: null,
        actionCategories: [],
      },
      {
        label: "App Integrations",
        description: "Seamlessly integrate with apps and services",
        icon: null,
        img: null,
        actionCategories: actionCategories,
      },
    ];
  }

  /**
   * Extracts the OpenAPI compatible JSON Schema for an LLM to utilize the tool.
   */
  public static getLlmToolSchema(integration: string, tool: string): any {
    const rawPlugin = this.getRawPlugin(integration);
    const metadata = IntegrationMetadataRegistry[integration] || {
      label: integration,
    };

    const { description } = this.getToolMetadata(
      rawPlugin,
      tool,
      metadata.label,
    );

    let zodSchema: any = null;
    if (rawPlugin.endpointSchemas && rawPlugin.endpointSchemas[tool]) {
      zodSchema = rawPlugin.endpointSchemas[tool].input;
    }

    let jsonSchemaParameters = {
      type: "object",
      properties: {},
      required: [],
    };

    if (zodSchema) {
      try {
        let parsedSchema: any = {};
        if (typeof zodSchema.toJSONSchema === "function") {
          parsedSchema = zodSchema.toJSONSchema();
        } else {
          parsedSchema = zodToJsonSchema(zodSchema, { target: "openApi3" });
        }

        jsonSchemaParameters = {
          type: "object",
          properties: parsedSchema.properties || {},
          required: parsedSchema.required || [],
        };
      } catch (error) {
        console.error(`Failed to parse Zod schema for tool: ${tool}`, error);
      }
    }

    return {
      type: "function",
      function: {
        name: `${integration}_${tool.replace(/\./g, "_")}`,
        description: description,
        parameters: jsonSchemaParameters,
      },
    };
  }

  /**
   * Generates the dynamic form configuration payload for rendering Aventisia UI parameter inputs.
   */
  public static getUiNodeConfig(integration: string, tool: string): any {
    const llmSchema = this.getLlmToolSchema(integration, tool);
    const parameters = llmSchema.function.parameters || {};
    const properties = parameters.properties || {};

    const requiredFields: string[] = Array.isArray(parameters.required)
      ? parameters.required
      : [];
    const metadata = IntegrationMetadataRegistry[integration] || {
      label: integration,
    };

    const pascalCaseWords = this.formatToolPath(tool);

    const configJson: any = {
      name: pascalCaseWords.join(""),
      description: llmSchema.function.description,
      version: "1.0.0",
      author: "@aventisia-gateway",
      supportedPlatforms: ["cloud", "windows"],
      errorHandling: "standard",
      testScreenType: "standard",
      fields: [],
    };

    configJson.fields.push({
      direction: "Input",
      type: "credentials-select",
      name: `__CredentialId__${integration.toUpperCase()}`,
      label: `${metadata.label} Credential`,
      description: `Select ${metadata.label} credentials used to authenticate the request.`,
      defaultValue: "",
      required: true,
    });

    for (const [key, prop] of Object.entries<any>(properties)) {
      const isRequired = requiredFields.includes(key);

      let fieldType = "text";
      let selectOptions = undefined;
      let defaultValue: any = "";

      if (prop.type === "boolean") {
        fieldType = "switch";
        defaultValue = prop.default !== undefined ? prop.default : false;
      } else if (prop.type === "number" || prop.type === "integer") {
        fieldType = "number";
        defaultValue = prop.default !== undefined ? prop.default : "";
      } else if (prop.enum && Array.isArray(prop.enum)) {
        fieldType = "select";
        defaultValue = prop.default || prop.enum[0] || "";
        selectOptions = prop.enum.map((value: string | number) => ({
          label: String(value),
          value: String(value),
          description: `Select option: ${value}`,
        }));
      } else if (prop.type === "object" || prop.type === "array") {
        fieldType = "text";
        defaultValue = prop.default ? JSON.stringify(prop.default) : "";
      } else {
        defaultValue = prop.default || "";
      }

      const humanReadableLabel = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase());

      const fallbackDescription = isRequired
        ? `Required parameter: ${humanReadableLabel}.`
        : `Optional parameter: ${humanReadableLabel}.`;

      configJson.fields.push({
        direction: "Input",
        type: fieldType,
        name: key,
        label: humanReadableLabel,
        description: prop.description || fallbackDescription,
        defaultValue: defaultValue,
        required: isRequired,
        ...(selectOptions && { selectOptions }),
      });
    }

    configJson.fields.push({
      direction: "Output",
      type: "config-panel-output",
      name: "Result",
      label: "Result",
      description: `Returns the response data from ${metadata.label} after executing ${tool}.`,
      defaultValue: { value: "Result", enabled: true },
    });

    return configJson;
  }
}
