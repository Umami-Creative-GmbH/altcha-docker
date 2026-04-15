import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import { createChallenge, verifySolution } from "altcha-lib";
import helmet from "helmet";
import path from "path";
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

  const port = process.env.PORT || 3000;
  const hmacKey = process.env.SECRET as string;
  const expireMinutes = (process.env.EXPIREMINUTES || 10) as number;
  const maxRecords = (process.env.MAXRECORDS || 1000) as number;
  const recordCache: string[] = [];

  if (hmacKey == "$ecret.key") console.log(" [WARNING] CHANGE ALTCHA SECRET KEY - its still default !!! ");

  app.get("/", (req: Request, res: Response) => {
    res.sendStatus(204);
  });

  app.get("/challenge", async (req: Request, res: Response) => {
    const challenge = await createChallenge({ hmacKey, expires: addMinutesToDate(new Date(), expireMinutes) });
    res.status(200).json(challenge);
  });

  app.get("/verify", async (req: Request, res: Response) => {
    if (recordCache.includes(req.query.altcha as string)) {
      // already verified
      res.sendStatus(417);
    } else {
      const ok = await verifySolution(req.query.altcha as string, hmacKey);
      recordCache.push(req.query.altcha as string);
      if (recordCache.length > maxRecords) recordCache.shift();
      res.sendStatus(ok ? 202 : 417);
    }
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

    app.get("/", (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, '/demo/index.html'));
    });

    app.post("/test", async (req: Request, res: Response) => {
      try {
        var result = await axios.get("http://localhost:3000/verify", { params: { altcha: req.body.altcha } })
        res.sendStatus(result.status);
      } catch (ex: any) {
        //console.error(ex);
        res.sendStatus(ex.status);
      }
    });

    app.listen(port, () => {
      console.log(`[ALTCHA]: Captcha Test Server is running at http://localhost:${port}`);
    });
  })();
}