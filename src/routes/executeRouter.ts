import { Router, Request, Response } from "express";
import {
  ExecuteRequestPayload,
  ExecuteResponsePayload,
  IntegrationCredentials,
} from "../types/index.js";
import { ProviderRegistry } from "../registry/ProviderRegistry.js";

export const executeRouter = Router();

// Helper to decode credentials
const getCredentials = (req: Request): IntegrationCredentials | null => {
  const credentialsHeader = req.headers["x-integration-credentials"] as string;
  if (!credentialsHeader) return null;
  try {
    return JSON.parse(
      Buffer.from(credentialsHeader, "base64").toString("utf-8"),
    );
  } catch {
    return null;
  }
};

/**
 * POST /api/execute
 * Standardized execution endpoint for Workflow Nodes and LLM Agents.
 */
executeRouter.post("/", async (req: Request, res: Response) => {
  const payload: ExecuteRequestPayload = req.body;
  const credentials = getCredentials(req);

  if (!payload.integration || !payload.tool) {
    return res.status(400).json({
      success: false,
      error: "Missing required payload parameters (integration, tool).",
    });
  }
  if (!credentials) {
    return res.status(401).json({
      success: false,
      error: "Missing or invalid x-integration-credentials header.",
    });
  }

  try {
    console.log(
      `[CES] Executing -> Integration: ${payload.integration} | Tool: ${payload.tool}`,
    );

    // 1. Get the abstract provider
    const provider = ProviderRegistry.getProvider(payload.integration);

    // 2. Execute
    const result = await provider.executeAction(payload, credentials);
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    const isIntercepted =
      error?.name === "PermissionPendingError" ||
      error?.message?.includes("blocked by the permission policy");

    if (isIntercepted) {
      console.log(`[CES] Stateless Interception Triggered for Write Action.`);
      return res.status(202).json({
        success: false,
        approvalRequired: true,
        // Echo back Aventisia's executionId if provided, otherwise fallback
        approvalId: payload.executionId || `stateless_req_${Date.now()}`,
        message: "This action requires human approval.",
      });
    }

    console.error(`[CES] Execution Failed:`, error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/execute/validate
 * Validates whether the provided credentials are valid for the target integration.
 */
executeRouter.post("/validate", async (req: Request, res: Response) => {
  const integration = req.body.integration;
  const credentials = getCredentials(req);

  if (!integration || !credentials) {
    return res.status(400).json({
      success: false,
      error: "Missing integration body or credentials header.",
    });
  }

  try {
    const provider = ProviderRegistry.getProvider(integration);
    const isValid = await provider.validateCredentials(
      integration,
      credentials,
    );
    return res.status(200).json({ success: true, isValid });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, isValid: false, error: error.message });
  }
});
