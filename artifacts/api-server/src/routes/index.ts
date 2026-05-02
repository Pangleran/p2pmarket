import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import authRouter from "./auth";
import usersRouter from "./users";
import avatarRouter from "./avatar";
import walletRouter from "./wallet";
import wijayapayRouter from "./wijayapay";
import listingsRouter from "./listings";
import transactionsRouter from "./transactions";
import adminRouter from "./admin";
import databaseRouter from "./database";
import chatRouter from "./chat";
import securityRouter from "./security";
import { authRateLimit, adminRateLimit, financialRateLimit } from "../middlewares/security";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(securityRouter);

// Auth routes: authRateLimit applied per-route inside auth.ts
router.use(authRouter);

router.use(usersRouter);
router.use(avatarRouter);
router.use(walletRouter);
router.use(wijayapayRouter);
router.use(listingsRouter);
router.use(transactionsRouter);
router.use(chatRouter);

// Admin routes: moderate rate limit (routes internally use /admin/... prefix)
router.use(adminRateLimit, adminRouter);
router.use(adminRateLimit, databaseRouter);

export default router;
