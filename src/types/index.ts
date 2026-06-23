/**
 * Represents the incoming execution payload from the C# orchestrator.
 */
export interface ExecuteRequestPayload {
  /** The name of the target integration (e.g., 'github', 'slack') */
  integration: string;
  /** The dot-notation path of the tool to execute (e.g., 'issues.create') */
  tool: string;
  /** The live, decrypted access token provided by the C# vault */
  token: string;
  /** Optional arguments required by the target tool */
  args?: Record<string, any>;
  /** Flag indicating if the human-in-the-loop has already approved this execution */
  isApproved?: boolean;
}

/**
 * Represents the standardized response sent back to the orchestrator.
 */
export interface ExecuteResponsePayload {
  success: boolean;
  data?: any;
  error?: string;
  approvalRequired?: boolean;
  approvalId?: string;
  message?: string;
}
