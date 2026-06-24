import fs from "fs/promises";
import path from "path";
import { ProviderRegistry } from "../src/registry/ProviderRegistry.js";
import { IntegrationMetadataRegistry } from "../src/metadata/IntegrationMetadata.js";

const CONFIG_OUTPUT_DIR = path.resolve(process.cwd(), "configs");

/**
 * Automates the creation of static UI configuration files for the Aventisia builder.
 * Extracts the dynamic UI configuration from the Provider abstractions and writes it to disk.
 */
async function syncUiConfigs() {
  console.log("Starting UI Configuration Sync...");

  await fs.mkdir(CONFIG_OUTPUT_DIR, { recursive: true });

  // 1. Build the Action Categories dynamically from the Provider Registry
  const actionCategories = [];
  for (const integrationId of Object.keys(IntegrationMetadataRegistry)) {
    try {
      const provider = ProviderRegistry.getProvider(integrationId);
      const actions = provider.getManifest(integrationId);
      const meta = IntegrationMetadataRegistry[integrationId];

      actionCategories.push({
        label: meta.label,
        description: meta.description,
        icon: null,
        img: meta.img,
        listType: null,
        actions: actions,
      });
    } catch (error) {
      console.warn(`Failed to generate manifest for ${integrationId}:`, error);
    }
  }

  // 2. Construct the Master Manifest
  const manifestList = [
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

  const appIntegrations = manifestList.find(
    (m: any) => m.label === "App Integrations",
  );

  if (!appIntegrations) {
    console.error("Failed to locate App Integrations category in manifest.");
    process.exit(1);
  }

  const manifestPath = path.join(
    CONFIG_OUTPUT_DIR,
    "CorsairActionSelectorMappingFile.json",
  );

  await fs.writeFile(
    manifestPath,
    JSON.stringify(manifestList, null, 2),
    "utf-8",
  );
  console.log(`Created Master Manifest: ${manifestPath}`);

  // 3. Iterate through actions and extract UI node configs from the Provider
  for (const category of appIntegrations.actionCategories) {
    for (const action of category.actions) {
      const { integration, tool } = action._routingConfig;

      // Extract config natively through the Provider Interface
      const provider = ProviderRegistry.getProvider(integration);
      const uiConfig = provider.getUiConfig(integration, tool);

      const toolWords = tool
        .split(".")
        .flatMap((segment: string) => segment.split(/(?=[A-Z])/));

      const pascalCase = toolWords.map(
        (word: string) => word.charAt(0).toUpperCase() + word.slice(1),
      );

      const fileName = `${pascalCase.join("")}.json`;
      const filePath = path.join(CONFIG_OUTPUT_DIR, fileName);

      await fs.writeFile(filePath, JSON.stringify(uiConfig, null, 2), "utf-8");
      console.log(`Generated Static Config: ${filePath}`);
    }
  }

  console.log(
    "\nSync Complete! All UI configurations are now static and ready for the frontend.",
  );
}

syncUiConfigs().catch((error) => {
  console.error("Sync failed:", error);
  process.exit(1);
});
