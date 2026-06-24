import { Router, Request, Response } from "express";
import { DiscoveryService } from "../services/DiscoveryService.js";

export const discoveryRouter = Router();

/**
 * GET /api/discovery/manifest
 * Returns the full JSON UI definition mapping for the Aventisia builder.
 */
discoveryRouter.get("/manifest", (req: Request, res: Response) => {
  try {
    const manifest = DiscoveryService.getAppIntegrationsManifest();
    return res.status(200).json(manifest);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/discovery/schema?integration=github&tool=issues.create
 * Returns the LLM-compatible function calling schema for a specific tool.
 */
discoveryRouter.get("/schema", (req: Request, res: Response) => {
  const integration = req.query.integration as string;
  const tool = req.query.tool as string;

  if (!integration || !tool) {
    return res.status(400).json({
      success: false,
      error: 'Query parameters "integration" and "tool" are required.',
    });
  }

  try {
    const schema = DiscoveryService.getLlmToolSchema(integration, tool);
    return res.status(200).json({ success: true, schema });
  } catch (error: any) {
    return res.status(404).json({ success: false, error: error.message });
  }
});
