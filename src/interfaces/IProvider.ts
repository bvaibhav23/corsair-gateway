import {
  ExecuteRequestPayload,
  IntegrationCredentials,
} from "../types/index.js";

export interface IProvider {
  /** Retrieves the available actions for an integration to build the UI manifest */
  getManifest(integrationId: string): any;

  /** Retrieves the strict JSON schema for the LLM to call the tool */
  getLlmSchema(integrationId: string, tool: string): any;

  /** Generates the UI configuration for the Aventisia workflow builder */
  getUiConfig(integrationId: string, tool: string): any;

  /** Executes the tool statelessly */
  executeAction(
    payload: ExecuteRequestPayload,
    credentials: IntegrationCredentials,
  ): Promise<any>;

  /** Lightweight ping to verify if the provided credentials are valid */
  validateCredentials(
    integrationId: string,
    credentials: IntegrationCredentials,
  ): Promise<boolean>;
}
