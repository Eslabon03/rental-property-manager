import { Router, type IRouter } from "express";
import healthRouter from "./health";
import propertiesRouter from "./properties";
import reservationsRouter from "./reservations";
import expensesRouter from "./expenses";

const router: IRouter = Router();

router.use(healthRouter);
router.use(propertiesRouter);
router.use(reservationsRouter);
router.use(expensesRouter);

export default router;
