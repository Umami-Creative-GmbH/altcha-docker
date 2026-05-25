import dotenv from "dotenv";

import { parseDemoConfig } from "./config";
import { createDemoApp } from "./demo-app";

dotenv.config();

const start = () => {
  const config = parseDemoConfig();
  const app = createDemoApp(config);

  app.listen(config.port, () => {
    console.log(`[ALTCHA]: Demo server is running at http://localhost:${config.port}`);
  });
};

try {
  start();
} catch (error: unknown) {
  console.error("[ALTCHA]: failed to start demo", error);
  process.exit(1);
}
