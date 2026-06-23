import { Router, Request, Response } from "express";
import { ExecutionService } from "../services/ExecutionService";
import {
  ExecuteRequestPayload,
  ExecuteResponsePayload,
  IntegrationCredentials,
} from "../types";

export const executeRouter = Router();

/**
 * POST /api/execute
 * * The primary execution gateway. Expects routing details in the body and
 * Base64-encoded credentials in the 'x-integration-credentials' header.
 */
executeRouter.post("/", async (req: Request, res: Response) => {
  const payload: ExecuteRequestPayload = req.body;
  const credentialsHeader = req.headers["x-integration-credentials"] as string;

  // 1. Validate Body Requirements
  if (!payload.integration || !payload.tool) {
    const response: ExecuteResponsePayload = {
      success: false,
      error: "Missing required payload parameters (integration, tool).",
    };
    return res.status(400).json(response);
  }

  // 2. Validate Header Requirements
  if (!credentialsHeader) {
    const response: ExecuteResponsePayload = {
      success: false,
      error: "Missing x-integration-credentials HTTP header.",
    };
    return res.status(401).json(response);
  }

  // 3. Decode the Base64 Credentials Dictionary
  let credentials: IntegrationCredentials;
  try {
    const decodedJson = Buffer.from(credentialsHeader, "base64").toString(
      "utf-8",
    );
    credentials = JSON.parse(decodedJson);
  } catch (err) {
    const response: ExecuteResponsePayload = {
      success: false,
      error:
        "Invalid credentials header format. Must be a Base64 encoded JSON string.",
    };
    return res.status(400).json(response);
  }

  try {
    console.log(
      `\n⚙️ [${payload.integration}] Routing Execution -> Tool: ${payload.tool}`,
    );

    // 4. Pass execution to the core engine
    const result = await ExecutionService.executeAction(payload, credentials);

    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    // 5. Human-in-the-loop Interception
    // Catches native pending errors and stateless hard-blocks
    const isIntercepted =
      error?.name === "PermissionPendingError" ||
      error?.message?.includes("blocked by the permission policy");

    if (isIntercepted) {
      console.log(`🚨 Stateless Interception Triggered for Write Action.`);
      const response: ExecuteResponsePayload = {
        success: false,
        approvalRequired: true,
        approvalId: `stateless_req_${Date.now()}`,
        message: "This action requires human approval.",
      };
      return res.status(202).json(response);
    }

    // Standard Error Fallback
    console.error(`❌ Execution Failed:`, error.message);
    const response: ExecuteResponsePayload = {
      success: false,
      error: error.message,
    };
    return res.status(500).json(response);
  }
});
