import { createCorsair } from "corsair";
import { zodToJsonSchema } from "zod-to-json-schema";
import { IProvider } from "../interfaces/IProvider.js";
import {
  ExecuteRequestPayload,
  IntegrationCredentials,
} from "../types/index.js";
import { getPluginFactory } from "../plugins/index.js";
import { IntegrationMetadataRegistry } from "../metadata/IntegrationMetadata.js";

export class CorsairProvider implements IProvider {
  private getDummyCredentials() {
    return {
      token: "dummy",
      clientId: "dummy",
      clientSecret: "dummy",
      accessToken: "dummy",
    };
  }

  private getRawPlugin(integration: string) {
    const factory = getPluginFactory(integration);
    return factory(this.getDummyCredentials(), false);
  }

  private getDummyCorsairContext(integration: string) {
    const plugin = this.getRawPlugin(integration);
    return createCorsair({
      plugins: [plugin],
      database: undefined,
      multiTenancy: false,
      kek: "",
    });
  }

  private extractToolPaths(apiObj: any, prefix: string = ""): string[] {
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

  private getToolMetadata(rawPlugin: any, tool: string, fallbackLabel: string) {
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

  // --- IProvider Implementations ---

  public getManifest(integrationId: string): any {
    const meta = IntegrationMetadataRegistry[integrationId];
    if (!meta) throw new Error(`Metadata not found for ${integrationId}`);

    const corsairInstance = this.getDummyCorsairContext(integrationId);
    const apiTree = (corsairInstance as any)[integrationId]?.api;
    if (!apiTree) return [];

    const rawPlugin = this.getRawPlugin(integrationId);
    const toolPaths = this.extractToolPaths(apiTree);

    return toolPaths.map((toolPath) => {
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
        description,
        docsLink: "https://docs.aventisia.com",
        img: meta.img,
        supportedPlatforms: ["cloud", "windows"],
        _routingConfig: {
          integration: integrationId,
          tool: toolPath,
        },
      };
    });
  }

  public getLlmSchema(integration: string, tool: string): any {
    const rawPlugin = this.getRawPlugin(integration);
    const meta = IntegrationMetadataRegistry[integration] || {
      label: integration,
    };
    const { description } = this.getToolMetadata(rawPlugin, tool, meta.label);

    let zodSchema: any = null;
    if (rawPlugin.endpointSchemas && rawPlugin.endpointSchemas[tool]) {
      zodSchema = rawPlugin.endpointSchemas[tool].input;
    }

    let jsonSchemaParameters = { type: "object", properties: {}, required: [] };

    if (zodSchema) {
      let parsedSchema: any =
        typeof zodSchema.toJSONSchema === "function"
          ? zodSchema.toJSONSchema()
          : zodToJsonSchema(zodSchema, { target: "openApi3" });

      jsonSchemaParameters = {
        type: "object",
        properties: parsedSchema.properties || {},
        required: parsedSchema.required || [],
      };
    }

    return {
      type: "function",
      function: {
        name: `${integration}_${tool.replace(/\./g, "_")}`,
        description,
        parameters: jsonSchemaParameters,
      },
    };
  }

  public getUiConfig(integration: string, tool: string): any {
    const llmSchema = this.getLlmSchema(integration, tool);
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
      description: llmSchema.function.description,
      version: "1.0.0",
      author: "@aventisia-gateway",
      supportedPlatforms: ["cloud", "windows"],
      errorHandling: "standard",
      testScreenType: "standard",
      fields: [
        {
          direction: "Input",
          type: "credentials-select",
          name: `__CredentialId__${integration.toUpperCase()}`,
          label: `${meta.label} Credential`,
          description: `Select ${meta.label} credentials used to authenticate the request.`,
          defaultValue: "",
          required: true,
        },
      ],
    };

    for (const [key, prop] of Object.entries<any>(properties)) {
      const isRequired = requiredFields.includes(key);
      const humanReadableLabel = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase());
      const smartFallbackDescription = isRequired
        ? `Required parameter: ${humanReadableLabel}.`
        : `Optional parameter: ${humanReadableLabel}.`;

      // Simplified mapping logic (similar to your previous implementation)
      let fieldType =
        prop.type === "boolean"
          ? "switch"
          : prop.type === "number"
            ? "number"
            : prop.enum
              ? "select"
              : "text";

      configJson.fields.push({
        direction: "Input",
        type: fieldType,
        name: key,
        label: humanReadableLabel,
        description: prop.description || smartFallbackDescription,
        defaultValue: prop.default || "",
        required: isRequired,
        ...(prop.enum && {
          selectOptions: prop.enum.map((v: any) => ({
            label: String(v),
            value: String(v),
          })),
        }),
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

  public async executeAction(
    payload: ExecuteRequestPayload,
    credentials: IntegrationCredentials,
  ): Promise<any> {
    const { integration, tool, args = {}, isApproved = false } = payload;
    const pluginFactory = getPluginFactory(integration);
    const plugin = pluginFactory(credentials, isApproved);

    const dynamicCorsair = createCorsair({
      plugins: [plugin],
      database: undefined, // Enforces 100% stateless execution
      multiTenancy: false,
      kek: "4Ep5doYkrb96Vh7EEQQghYyFsdR/5oFSo7ix04JVqQw=",
    });

    const parts = tool.split(".");
    let current = (dynamicCorsair as any)[integration]?.api;
    let parent = (dynamicCorsair as any)[integration];

    for (const part of parts) {
      parent = current;
      current = current[part];
    }

    return await current.bind(parent)(args);
  }

  public async validateCredentials(
    integrationId: string,
    credentials: IntegrationCredentials,
  ): Promise<boolean> {
    try {
      // Corsair specific implementation: we attempt to call a safe "read" endpoint like 'users.getAuthenticated'
      // If we don't know a safe endpoint, we could try initializing the SDK and making a basic call.
      // This varies by plugin. For safety, if it doesn't throw on initialization, we can assume it's structurally valid,
      // but true validation requires a network ping.
      const factory = getPluginFactory(integrationId);
      factory(credentials, false);
      // Note: A true ping depends on the specific integration's safe "me" endpoint.
      return true;
    } catch (e) {
      return false;
    }
  }
}
