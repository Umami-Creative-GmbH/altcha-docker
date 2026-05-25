import dotenv from "dotenv";

import { createApiApp } from "./api-app";
import { parseApiConfig } from "./config";

dotenv.config();

const start = async () => {
  const config = parseApiConfig();

  if (config.hmacKey === "$ecret.key") console.log(" [WARNING] CHANGE ALTCHA SECRET KEY - its still default !!! ");

  const app = await createApiApp(config);

  app.listen(config.port, () => {
    console.log(`[ALTCHA]: Captcha Server is running at http://localhost:${config.port}`);
  });
};

start().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
