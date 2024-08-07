import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import { createChallenge, verifySolution } from "altcha-lib";
import helmet from "helmet";
import path from "path";
import cors from "cors";
import axios from 'axios';

dotenv.config();

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

  if (hmacKey == "$ecret.key") console.log(" [WARNING] CHANGE ALTCHA SECRET KEY - its still default !!! ");

  app.get("/", (req: Request, res: Response) => {
    res.sendStatus(204);
  });

  app.get("/challenge", async (req: Request, res: Response) => {
    const challenge = await createChallenge({ hmacKey });
    res.status(200).json(challenge);
  });

  app.get("/verify", async (req: Request, res: Response) => {
    const ok = await verifySolution(req.query.altcha as string, hmacKey);
    res.sendStatus(ok ? 202 : 417);
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
          "script-src": ["'self'", "https://cdn.jsdelivr.net", "http://localhost:3000"],
          "connect-src": ["'self'", "http://localhost:3000"] 
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
      var result = await axios.get("http://localhost:3000/verify", { params: {altcha: req.body.altcha }})
      res.sendStatus(result.status);
    });
  
    app.listen(port, () => {
      console.log(`[ALTCHA]: Captcha Test Server is running at http://localhost:${port}`);
    });
  })();
}