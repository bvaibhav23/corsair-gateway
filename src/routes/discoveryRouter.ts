import { Router, Request, Response } from "express";
import { DiscoveryService } from "../services/DiscoveryService.js";

export const discoveryRouter = Router();

// GET /api/discovery/manifest
discoveryRouter.get("/manifest", (req: Request, res: Response) => {
  try {
    const manifestList = DiscoveryService.getAppIntegrationsManifest();
    return res.status(200).json(manifestList);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/discovery/schema
discoveryRouter.get("/schema", (req: Request, res: Response) => {
  const { integration, tool } = req.query as {
    integration: string;
    tool: string;
  };
  try {
    const schema = DiscoveryService.getLlmToolSchema(integration, tool);
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
    const config = DiscoveryService.getUiNodeConfig(integration, tool);
    return res.status(200).json({ success: true, config });
  } catch (error: any) {
    return res.status(404).json({ success: false, error: error.message });
  }
});
