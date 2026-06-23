/**
 * A flexible dictionary to hold any type of credentials required by an integration.
 * For example:
 * - GitHub (API Key): { token: "ghp_..." }
 * - Outlook (OAuth 2.0): { clientId: "...", clientSecret: "...", accessToken: "..." }
 */
export type IntegrationCredentials = Record<string, string>;

/**
 * Represents the incoming execution payload from the C# orchestrator.
 * Note: Authentication credentials are NOT passed here. They are passed
 * securely via the 'x-integration-credentials' HTTP header as a Base64 JSON string.
 */
export interface ExecuteRequestPayload {
  /** The name of the target integration (e.g., 'github', 'outlook') */
  integration: string;
  /** The dot-notation path of the tool to execute (e.g., 'issues.create', 'mail.list') */
  tool: string;
  /** Optional arguments required by the target tool */
  args?: Record<string, any>;
  /** Flag indicating if the human-in-the-loop has already approved this execution to bypass strict mode */
  isApproved?: boolean;
}

/**
 * Represents the standardized response sent back to the orchestrator.
 */
export interface ExecuteResponsePayload {
  /** Indicates whether the execution was successful or if an error/interception occurred */
  success: boolean;
  /** The raw data returned from the third-party API upon success */
  data?: any;
  /** A human-readable error message if the execution failed */
  error?: string;
  /** True if the action was intercepted by Corsair's strict mode (Write action) */
  approvalRequired?: boolean;
  /** A tracking ID for the intercepted action (Stateless dummy ID in this architecture) */
  approvalId?: string;
  /** A message explaining why the action was intercepted */
  message?: string;
}
