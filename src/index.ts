import express, { type Express, type Request, type Response } from "express";
import dotenv from "dotenv";
import { createChallenge } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import { deriveHmacKeySecret, verify as verifyPayload } from "altcha-lib/frameworks/shared";
import helmet from "helmet";
import path from "node:path";
import cors from "cors";
import axios from 'axios';

dotenv.config();

const addMinutesToDate = (date: Date, n: number) => {
  const d = new Date(date);
  d.setTime(d.getTime() + n * 60_000);
  return d;
};

(async () => {
  const app: Express = express();
  app.use(helmet());
  app.use(express.json());

  const corsOptions = {
    origin: '*'
  };

  app.use(cors(corsOptions));

  const port = Number(process.env.PORT || 3000);
  const hmacKey = process.env.SECRET as string;
  const expireMinutes = Number(process.env.EXPIREMINUTES || 10);
  const maxRecords = Number(process.env.MAXRECORDS || 1000);
  const cost = Number(process.env.COST || 5000);
  const algorithm = process.env.ALGORITHM || "PBKDF2/SHA-256";
  const hmacKeySignatureSecret = await deriveHmacKeySecret(hmacKey);

  const usedChallengeIds = new Set<string>();
  const challengeOrder: string[] = [];
  const replayStore = {
    get: (key: string) => usedChallengeIds.has(key),
    set: (key: string, value: boolean) => {
      if (!value || usedChallengeIds.has(key)) return;
      usedChallengeIds.add(key);
      challengeOrder.push(key);
      if (challengeOrder.length > maxRecords) {
        const oldest = challengeOrder.shift();
        if (oldest) usedChallengeIds.delete(oldest);
      }
    }
  };

  if (hmacKey === "$ecret.key") console.log(" [WARNING] CHANGE ALTCHA SECRET KEY - its still default !!! ");

  app.get("/", (_req: Request, res: Response) => {
    res.sendStatus(204);
  });

  app.get("/challenge", async (_req: Request, res: Response) => {
    const challenge = await createChallenge({
      algorithm,
      cost,
      deriveKey,
      expiresAt: addMinutesToDate(new Date(), expireMinutes),
      hmacSignatureSecret: hmacKey,
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

    const result = await verifyPayload(payload, deriveKey, hmacKey, hmacKeySignatureSecret, replayStore);
    res.sendStatus(result.error ? 417 : 202);
  });

  app.listen(port, () => {
    console.log(`[ALTCHA]: Captcha Server is running at http://localhost:${port}`);
  });
})();

if (process.env.DEMO?.toLowerCase() === "true") {
  (async () => {
    const app: Express = express();
    app.use(helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "script-src": ["'self'", "https://cdn.jsdelivr.net", "http://localhost:3000", "http://localhost:8080"],
          "connect-src": ["'self'", "http://localhost:3000", "http://localhost:8080", "blob://*"],
          "worker-src": ["'self'", "http://localhost:3000", "http://localhost:8080", "blob://*"],
        }
      }
    }));

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const port = 8080;

    app.get("/", (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, '/demo/index.html'));
    });

    app.post("/test", async (req: Request, res: Response) => {
      try {
        const result = await axios.get("http://localhost:3000/verify", { params: { altcha: req.body.altcha } })
        res.sendStatus(result.status);
      } catch (ex) {
        const error = ex as { status?: number; response?: { status?: number } };
        res.sendStatus(error.response?.status || error.status || 417);
      }
    });

    app.listen(port, () => {
      console.log(`[ALTCHA]: Captcha Test Server is running at http://localhost:${port}`);
    });
  })();
}