import { createCorsair } from "corsair";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getPluginFactory } from "../plugins/index.js";
import { IntegrationMetadataRegistry } from "../metadata/IntegrationMetadata.js";

export class DiscoveryService {
  /**
   * Centralized dummy credentials for instantiating plugins statelessly.
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
   * Single Source of Truth: Retrieves the RAW, un-wrapped plugin directly from the factory.
   * This is required because Corsair strips metadata dictionaries (like endpointMeta)
   * when wrapping plugins into the executable 'api' tree.
   */
  private static getRawPlugin(integration: string) {
    const factory = getPluginFactory(integration);
    return factory(this.getDummyCredentials(), false);
  }

  /**
   * Instantiates the wrapped Corsair instance solely to read the executable API tree.
   */
  private static getDummyCorsairContext(integration: string) {
    const factory = getPluginFactory(integration);
    const plugin = factory(this.getDummyCredentials(), false);

    return createCorsair({
      plugins: [plugin],
      database: undefined,
      multiTenancy: false,
      kek: "",
    });
  }

  /**
   * Recursively traverses a Corsair API tree to extract all available tool paths.
   */
  private static extractToolPaths(apiObj: any, prefix: string = ""): string[] {
    let paths: string[] = [];
    for (const key of Object.keys(apiObj)) {
      const value = apiObj[key];
      const newPrefix = prefix ? `${prefix}.${key}` : key;

      if (typeof value === "function") {
        paths.push(newPrefix);
      } else if (typeof value === "object" && value !== null) {
        paths = paths.concat(this.extractToolPaths(value, newPrefix));
      }
    }
    return paths;
  }

  /**
   * SINGLE SOURCE OF TRUTH FOR METADATA
   * Extracts highly accurate descriptions and risk levels directly from the raw plugin dictionaries.
   * Feeds both the UI Manifest and the LLM Schema to guarantee exact consistency.
   */
  private static getToolMetadata(
    rawPlugin: any,
    tool: string,
    fallbackLabel: string,
  ) {
    let description = `Execute the ${tool} action via the ${fallbackLabel} integration.`;

    // 1. Check Standard API Actions (e.g., rawPlugin.endpointMeta['issues.create'])
    if (rawPlugin?.endpointMeta?.[tool]) {
      description =
        rawPlugin.endpointMeta[tool].description ||
        rawPlugin.endpointMeta[tool].summary ||
        description;
    }
    // 2. Check Webhook Subscriptions/Actions
    else if (rawPlugin?.webhookSchemas?.[tool]) {
      description = rawPlugin.webhookSchemas[tool].description || description;
    }

    return { description };
  }

  /**
   * Generates the full UI Manifest matching the Aventisia Action Selector JSON structure.
   */
  public static getAppIntegrationsManifest(): any {
    const actionCategories = [];

    for (const integrationId of Object.keys(IntegrationMetadataRegistry)) {
      const meta = IntegrationMetadataRegistry[integrationId];

      try {
        // 1. Get the wrapper to extract the executable paths
        const corsairInstance = this.getDummyCorsairContext(integrationId);
        const apiTree = (corsairInstance as any)[integrationId]?.api;

        if (!apiTree) continue;

        // 2. Get the RAW plugin to extract the metadata
        const rawPlugin = this.getRawPlugin(integrationId);
        const toolPaths = this.extractToolPaths(apiTree);

        const actions = toolPaths.map((toolPath) => {
          // Utilize the centralized metadata extractor for consistent descriptions
          const { description } = this.getToolMetadata(
            rawPlugin,
            toolPath,
            meta.label,
          );

          // const pascalCase = toolPath
          //   .split(".")
          //   .map((part) => part.charAt(0).toUpperCase() + part.slice(1));

          const toolWords = toolPath
            .split(".")
            .flatMap((segment) => segment.split(/(?=[A-Z])/));

          const pascalCase = toolWords.map(
            (word) => word.charAt(0).toUpperCase() + word.slice(1),
          );
          return {
            type: "corsairNode",
            name: pascalCase.join(""),
            label: pascalCase.join(" "),
            description: description, // Matches LLM schema perfectly
            docsLink: "https://docs.aventisia.com",
            img: meta.img,
            supportedPlatforms: ["cloud", "windows"],
            _routingConfig: {
              integration: integrationId,
              tool: toolPath,
            },
          };
        });

        actionCategories.push({
          label: meta.label,
          description: meta.description,
          icon: null,
          img: meta.img,
          listType: null,
          actions: actions,
        });
      } catch (error) {
        console.warn(
          `Failed to generate manifest for ${integrationId}:`,
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
   * Extracts the strict LLM function calling schema for a specific tool.
   */
  public static getLlmToolSchema(integration: string, tool: string): any {
    const rawPlugin = this.getRawPlugin(integration);
    const meta = IntegrationMetadataRegistry[integration] || {
      label: integration,
    };

    // Utilize the centralized metadata extractor for consistent descriptions
    const { description } = this.getToolMetadata(rawPlugin, tool, meta.label);

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
      } catch (e) {
        console.error(`[Discovery] Failed to parse Zod schema for ${tool}:`, e);
      }
    }

    return {
      type: "function",
      function: {
        name: `${integration}_${tool.replace(/\./g, "_")}`,
        description: description, // Matches UI Manifest perfectly
        parameters: jsonSchemaParameters,
      },
    };
  }

  /**
   * Dynamically generates the Aventisia UI Configuration JSON for a specific tool.
   */
  public static getUiNodeConfig(integration: string, tool: string): any {
    const llmSchema = this.getLlmToolSchema(integration, tool);
    const parameters = llmSchema.function.parameters || {};
    const properties = parameters.properties || {};

    const requiredFields: string[] = Array.isArray(parameters.required)
      ? parameters.required
      : [];

    const meta = IntegrationMetadataRegistry[integration] || {
      label: integration,
    };

    const toolWords = tool
      .split(".")
      .flatMap((segment) => segment.split(/(?=[A-Z])/));

    const pascalCase = toolWords.map(
      (word) => word.charAt(0).toUpperCase() + word.slice(1),
    );
    const configJson: any = {
      name: pascalCase.join(""),
      description: llmSchema.function.description, // Strictly inherited from the LLM Schema
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
      label: `${meta.label} Credential`,
      description: `Select ${meta.label} credentials used to authenticate the request.`,
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
        selectOptions = prop.enum.map((val: string | number) => ({
          label: String(val),
          value: String(val),
          description: `Select option: ${val}`,
        }));
      } else if (prop.type === "object" || prop.type === "array") {
        fieldType = "text";
        defaultValue = prop.default ? JSON.stringify(prop.default) : "";
      } else {
        defaultValue = prop.default || "";
      }

      // Convert camelCase to Title Case (e.g., 'pullRequestId' -> 'Pull Request Id')
      const humanReadableLabel = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase());

      // Smart Fallback: If Corsair lacks a description, tell the user if it's required/optional
      const smartFallbackDescription = isRequired
        ? `Required parameter: ${humanReadableLabel}.`
        : `Optional parameter: ${humanReadableLabel}.`;

      configJson.fields.push({
        direction: "Input",
        type: fieldType,
        name: key,
        label: humanReadableLabel,
        // Uses Corsair's description if available, otherwise uses the smart fallback
        description: prop.description || smartFallbackDescription,
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
      description: `Returns the response data from ${meta.label} after executing ${tool}.`,
      defaultValue: { value: "Result", enabled: true },
    });

    return configJson;
  }
}
