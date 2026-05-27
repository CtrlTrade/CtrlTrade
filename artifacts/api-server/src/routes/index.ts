import { Router, type IRouter } from "express";
import pricingRouter from "./pricing";
import authRouter from "./auth";
import paymentRouter from "./payment";
import tenantRouter from "./tenant";
import subscriptionRouter from "./subscription";
import onboardingRouter from "./onboarding";
import adminRouter from "./admin";

const router: IRouter = Router();

router.get("/v1/health", (_req, res) => {
  res.json({ status: "ok" });
});
router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

router.use(pricingRouter);
router.use(authRouter);
router.use(paymentRouter);
router.use(tenantRouter);
router.use(subscriptionRouter);
router.use(onboardingRouter);
router.use(adminRouter);

export default router;
