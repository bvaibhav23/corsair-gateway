/**
 * Defines the frontend display metadata for each supported integration.
 * This ensures the gateway dictates the UI structure without hardcoding it in the frontend.
 */
export interface IntegrationMetadata {
  label: string;
  description: string;
  img: string;
}

export const IntegrationMetadataRegistry: Record<string, IntegrationMetadata> =
  {
    github: {
      label: "GitHub",
      description:
        "Manage repositories, issues, and pull requests via GitHub API.",
      img: "/assets/GitHub.svg",
    },
    outlook: {
      label: "Microsoft 365 Outlook",
      description:
        "Connect to Microsoft 365 Outlook to send, retrieve, and manage emails.",
      img: "/assets/M365.svg",
    },
  };
