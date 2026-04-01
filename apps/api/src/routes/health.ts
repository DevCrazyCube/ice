import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";

export const healthRouter: Router = createRouter();

healthRouter.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
