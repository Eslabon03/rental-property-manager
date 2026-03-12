import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { expensesTable, propertiesTable } from "@workspace/db/schema";
import { CreateExpenseBody, ListExpensesResponse, ListExpensesQueryParams } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/expenses", async (req, res) => {
  const query = ListExpensesQueryParams.parse(req.query);
  let rows;
  if (query.propertyId) {
    rows = await db
      .select({
        id: expensesTable.id,
        propertyId: expensesTable.propertyId,
        category: expensesTable.category,
        description: expensesTable.description,
        amount: expensesTable.amount,
        date: expensesTable.date,
        createdAt: expensesTable.createdAt,
        propertyName: propertiesTable.name,
      })
      .from(expensesTable)
      .leftJoin(propertiesTable, eq(expensesTable.propertyId, propertiesTable.id))
      .where(eq(expensesTable.propertyId, query.propertyId))
      .orderBy(expensesTable.createdAt);
  } else {
    rows = await db
      .select({
        id: expensesTable.id,
        propertyId: expensesTable.propertyId,
        category: expensesTable.category,
        description: expensesTable.description,
        amount: expensesTable.amount,
        date: expensesTable.date,
        createdAt: expensesTable.createdAt,
        propertyName: propertiesTable.name,
      })
      .from(expensesTable)
      .leftJoin(propertiesTable, eq(expensesTable.propertyId, propertiesTable.id))
      .orderBy(expensesTable.createdAt);
  }
  const mapped = rows.map((e) => ({
    ...e,
    date: new Date(e.date),
    amount: Number(e.amount),
    propertyName: e.propertyName ?? "Unknown",
  }));
  const data = ListExpensesResponse.parse(mapped);
  res.json(data);
});

router.post("/expenses", async (req, res) => {
  const body = CreateExpenseBody.parse(req.body);
  const dateStr = body.date instanceof Date ? body.date.toISOString().split("T")[0] : String(body.date);
  const [expense] = await db.insert(expensesTable).values({
    propertyId: body.propertyId,
    category: body.category,
    description: body.description,
    amount: String(body.amount),
    date: dateStr,
  }).returning();
  res.status(201).json({
    ...expense,
    date: new Date(expense.date),
    amount: Number(expense.amount),
  });
});

export default router;
