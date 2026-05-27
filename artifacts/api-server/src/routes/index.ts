import { Router, type IRouter } from "express";
import pricingRouter from "./pricing";
import authRouter from "./auth";
import paymentRouter from "./payment";
import tenantRouter from "./tenant";
import subscriptionRouter from "./subscription";
import billingRouter from "./billing";
import onboardingRouter from "./onboarding";
import adminRouter from "./admin";
import customersRouter from "./customers";
import quotesRouter from "./quotes";
import jobsRouter from "./jobs";
import fleetRouter from "./fleet";
import complianceRouter from "./compliance";
import teamRouter from "./team";
import dashboardRouter from "./dashboard";
import posRouter from "./pos";

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
router.use(billingRouter);
router.use(onboardingRouter);
router.use(adminRouter);
router.use(customersRouter);
router.use(quotesRouter);
router.use(jobsRouter);
router.use(fleetRouter);
router.use(complianceRouter);
router.use(teamRouter);
router.use(dashboardRouter);
router.use(posRouter);

export default router;
