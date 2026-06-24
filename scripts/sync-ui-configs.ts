import fs from "fs/promises";
import path from "path";
import { DiscoveryService } from "../src/services/DiscoveryService.js";

const CONFIG_OUTPUT_DIR = path.resolve(process.cwd(), "configs");

/**
 * Automates the creation of static UI configuration files for the Aventisia builder.
 * Extracts the dynamic UI configuration from the DiscoveryService and writes it to disk.
 */
async function syncUiConfigs() {
  console.log("Starting UI Configuration Sync...");

  await fs.mkdir(CONFIG_OUTPUT_DIR, { recursive: true });

  const manifestList = DiscoveryService.getAppIntegrationsManifest();
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

  for (const category of appIntegrations.actionCategories) {
    for (const action of category.actions) {
      const { integration, tool } = action._routingConfig;

      // const integrationDir = path.join(CONFIG_OUTPUT_DIR, integration);
      await fs.mkdir(CONFIG_OUTPUT_DIR, { recursive: true });

      const uiConfig = DiscoveryService.getUiNodeConfig(integration, tool);
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
    "Sync Complete! All UI configurations are now static and ready for the frontend.",
  );
}

syncUiConfigs().catch((error) => {
  console.error("Sync failed:", error);
  process.exit(1);
});
