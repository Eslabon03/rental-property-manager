import { Router, type IRouter } from "express";
import healthRouter from "./health";
import propertiesRouter from "./properties";
import reservationsRouter from "./reservations";
import expensesRouter from "./expenses";
import icalSyncRouter from "./ical-sync";
import icalExportRouter from "./ical-export";

const router: IRouter = Router();

router.use(healthRouter);
router.use(propertiesRouter);
router.use(reservationsRouter);
router.use(expensesRouter);
router.use(icalSyncRouter);
router.use(icalExportRouter);

export default router;
