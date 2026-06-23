import { Router, Request, Response } from 'express';
import { ExecutionService } from '../services/ExecutionService';
import { ExecuteRequestPayload, ExecuteResponsePayload } from '../types';

export const executeRouter = Router();

executeRouter.post('/', async (req: Request, res: Response) => {
  const payload: ExecuteRequestPayload = req.body;
  const headers: ExecuteRequestPayload = req.headers;

  // Basic validation
  if (!payload.token || !payload.integration || !payload.tool) {
    const response: ExecuteResponsePayload = { 
      success: false, 
      error: 'Missing required payload parameters (token, integration, tool).' 
    };
    return res.status(400).json(response);
  }

  try {
    console.log(`\n⚙️ [${payload.integration}] Routing Execution -> Tool: ${payload.tool}`);

    const result = await ExecutionService.executeAction(payload);
    
    return res.status(200).json({ success: true, data: result });

  } catch (error: any) {
    // Human-in-the-loop Interception (Catches native pending errors and hard-blocks)
    const isIntercepted = 
      error?.name === 'PermissionPendingError' || 
      error?.message?.includes('blocked by the permission policy');

    if (isIntercepted) {
      console.log(`🚨 Stateless Interception Triggered for Write Action.`);
      const response: ExecuteResponsePayload = {
        success: false,
        approvalRequired: true,
        approvalId: `stateless_req_${Date.now()}`,
        message: 'This action requires human approval.'
      };
      return res.status(202).json(response);
    }

    // Standard Error Fallback
    console.error(`❌ Execution Failed:`, error.message);
    const response: ExecuteResponsePayload = { 
      success: false, 
      error: error.message 
    };
    return res.status(500).json(response);
  }
});