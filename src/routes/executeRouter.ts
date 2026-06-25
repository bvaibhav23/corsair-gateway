import { Router, Request, Response } from "express";
import { ExecutionService } from "../services/ExecutionService.js";
import {
  ExecuteRequestPayload,
  IntegrationCredentials,
} from "../types/index.js";

export const executeRouter = Router();

/**
 * Helper to safely decode Base64 credentials from the incoming request header.
 */
const extractCredentials = (req: Request): IntegrationCredentials | null => {
  const credentialsHeader = req.headers["x-integration-credentials"] as string;
  if (!credentialsHeader) return null;
  try {
    const decodedPayload = Buffer.from(credentialsHeader, "base64").toString(
      "utf-8",
    );
    return JSON.parse(decodedPayload);
  } catch (error) {
    return null;
  }
};

/**
 * POST /api/execute
 * Standard execution endpoint.
 */
executeRouter.post("/", async (req: Request, res: Response) => {
  const payload: ExecuteRequestPayload = req.body;
  const credentials = extractCredentials(req);

  if (!payload.integration || !payload.tool) {
    return res.status(400).json({
      success: false,
      error: "Missing required payload parameters (integration, tool).",
    });
  }

  if (!credentials) {
    return res.status(401).json({
      success: false,
      error: "Missing or invalid x-integration-credentials HTTP header.",
    });
  }

  try {
    console.log(
      `Executing Integration: ${payload.integration} | Tool: ${payload.tool}`,
    );
    const result = await ExecutionService.executeAction(payload, credentials);
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    const isIntercepted =
      error?.name === "PermissionPendingError" ||
      error?.message?.includes("blocked by the permission policy");

    if (isIntercepted) {
      console.log(
        `Stateless interception triggered for write action requiring approval.`,
      );
      return res.status(202).json({
        success: false,
        approvalRequired: true,
        approvalId: payload.executionId || `stateless_req_${Date.now()}`,
        message: "This action requires human approval before proceeding.",
      });
    }

    console.error(`Execution Failed:`, error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/execute/validate
 * Validates the provided credentials without executing a state-changing action.
 */
executeRouter.post("/validate", async (req: Request, res: Response) => {
  const integrationId = req.body.integration;
  const credentials = extractCredentials(req);

  if (!integrationId || !credentials) {
    return res.status(400).json({
      success: false,
      error: "Missing integration body parameter or credentials header.",
    });
  }

  try {
    const isValid = await ExecutionService.validateCredentials(
      integrationId,
      credentials,
    );
    return res.status(200).json({ success: true, isValid });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, isValid: false, error: error.message });
  }
});
