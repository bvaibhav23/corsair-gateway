import { Router, Request, Response } from "express";
import { ProviderRegistry } from "../registry/ProviderRegistry.js";
import { IntegrationMetadataRegistry } from "../metadata/IntegrationMetadata.js";

export const discoveryRouter = Router();

// GET /api/discovery/manifest
discoveryRouter.get("/manifest", (req: Request, res: Response) => {
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
      console.warn(`Failed to generate manifest for ${integrationId}`);
    }
  }

  return res.status(200).json([
    { label: "Data Transformations", actionCategories: [] },
    { label: "UI Interface Automations", actionCategories: [] },
    { label: "App Integrations", actionCategories: actionCategories },
  ]);
});

// GET /api/discovery/schema
discoveryRouter.get("/schema", (req: Request, res: Response) => {
  const { integration, tool } = req.query as {
    integration: string;
    tool: string;
  };
  try {
    const provider = ProviderRegistry.getProvider(integration);
    const schema = provider.getLlmSchema(integration, tool);
    return res.status(200).json({ success: true, schema });
  } catch (error: any) {
    return res.status(404).json({ success: false, error: error.message });
  }
});

// GET /api/discovery/ui-config
discoveryRouter.get("/ui-config", (req: Request, res: Response) => {
  const { integration, tool } = req.query as {
    integration: string;
    tool: string;
  };
  try {
    const provider = ProviderRegistry.getProvider(integration);
    const config = provider.getUiConfig(integration, tool);
    return res.status(200).json({ success: true, config });
  } catch (error: any) {
    return res.status(404).json({ success: false, error: error.message });
  }
});
