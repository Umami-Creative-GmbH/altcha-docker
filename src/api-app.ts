import { createChallenge } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import { deriveHmacKeySecret, verify as verifyPayload } from "altcha-lib/frameworks/shared";
import cors from "cors";
import express, { type Express, type Request, type Response } from "express";
import helmet from "helmet";

import type { ApiConfig } from "./config";
import { createInMemoryReplayStore } from "./replay-store";

const addMinutesToDate = (date: Date, n: number) => {
  const d = new Date(date);
  d.setTime(d.getTime() + n * 60_000);
  return d;
};

export const createApiApp = async (config: ApiConfig): Promise<Express> => {
  const app: Express = express();
  const hmacKeySignatureSecret = await deriveHmacKeySecret(config.hmacKey);
  const replayStore = createInMemoryReplayStore(config.maxRecords);

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));

  app.get("/", (_req: Request, res: Response) => {
    res.sendStatus(204);
  });

  app.get("/challenge", async (_req: Request, res: Response) => {
    const challenge = await createChallenge({
      algorithm: config.algorithm,
      cost: config.maxNumber,
      deriveKey,
      expiresAt: addMinutesToDate(new Date(), config.expireMinutes),
      hmacSignatureSecret: config.hmacKey,
      hmacKeySignatureSecret,
    });

    res.status(200).json(challenge);
  });

  app.get("/verify", async (req: Request, res: Response) => {
    const payload = req.query.altcha;
    if (typeof payload !== "string" || !payload.length) {
      res.sendStatus(417);
      return;
    }

    const result = await verifyPayload(payload, deriveKey, config.hmacKey, hmacKeySignatureSecret, replayStore);
    res.sendStatus(result.error ? 417 : 202);
  });

  return app;
};
