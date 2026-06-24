# 🧩 Adding a New Integration

This directory manages the individual SaaS integrations (plugins) that are
loaded into the default `CorsairProvider`.

To add a new application (e.g., **Slack**) to the CES, follow these exactly 5
steps:

## Step 1: Install the Package

```bash
npm install @corsair-dev/slack
```

## Step 2: Create the Plugin Factory

Create a new file `src/plugins/slack.ts`:

```typescript
import { slackPlugin } from "@corsair-dev/slack";

export const createSlackPlugin = (
  credentials: Record<string, string>,
  isApproved: boolean,
) => {
  return slackPlugin({
    auth: {
      token: credentials.token,
    },
    permissions: isApproved ? { mode: "permissive" } : { mode: "strict" },
  });
};
```

## Step 3: Register the Factory

Export the newly created factory in `src/plugins/index.ts`:

```typescript
import { createGithubPlugin } from "./github.js";
import { createOutlookPlugin } from "./outlook.js";
import { createSlackPlugin } from "./slack.js";

const pluginRegistry: Record<string, Function> = {
  github: createGithubPlugin,
  outlook: createOutlookPlugin,
  slack: createSlackPlugin,
};
```

## Step 4: Add Metadata for the UI Builder

Open `src/metadata/IntegrationMetadata.ts`:

```typescript
export const IntegrationMetadataRegistry: Record<string, IntegrationMetadata> =
  {
    slack: {
      label: "Slack",
      description:
        "Send messages, manage channels, and automate team communication.",
      img: "https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg",
    },
  };
```

## Step 5: Sync the UI Configurations

```bash
npx tsx scripts/sync-ui-configs.ts
```

This will automatically crawl the new Slack plugin, extract all its tools, build
the LLM JSON schemas, dynamically generate the form inputs, and output them as
static JSON files in the `/configs` directory.
