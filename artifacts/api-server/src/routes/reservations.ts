import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { reservationsTable, propertiesTable } from "@workspace/db/schema";
import { CreateReservationBody, ListReservationsResponse, ListReservationsQueryParams } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/reservations", async (req, res) => {
  const query = ListReservationsQueryParams.parse(req.query);
  let rows;
  if (query.propertyId) {
    rows = await db
      .select({
        id: reservationsTable.id,
        propertyId: reservationsTable.propertyId,
        guestName: reservationsTable.guestName,
        checkIn: reservationsTable.checkIn,
        checkOut: reservationsTable.checkOut,
        totalAmount: reservationsTable.totalAmount,
        status: reservationsTable.status,
        notes: reservationsTable.notes,
        createdAt: reservationsTable.createdAt,
        propertyName: propertiesTable.name,
      })
      .from(reservationsTable)
      .leftJoin(propertiesTable, eq(reservationsTable.propertyId, propertiesTable.id))
      .where(eq(reservationsTable.propertyId, query.propertyId))
      .orderBy(reservationsTable.createdAt);
  } else {
    rows = await db
      .select({
        id: reservationsTable.id,
        propertyId: reservationsTable.propertyId,
        guestName: reservationsTable.guestName,
        checkIn: reservationsTable.checkIn,
        checkOut: reservationsTable.checkOut,
        totalAmount: reservationsTable.totalAmount,
        status: reservationsTable.status,
        notes: reservationsTable.notes,
        createdAt: reservationsTable.createdAt,
        propertyName: propertiesTable.name,
      })
      .from(reservationsTable)
      .leftJoin(propertiesTable, eq(reservationsTable.propertyId, propertiesTable.id))
      .orderBy(reservationsTable.createdAt);
  }
  const mapped = rows.map((r) => ({
    ...r,
    checkIn: new Date(r.checkIn),
    checkOut: new Date(r.checkOut),
    totalAmount: Number(r.totalAmount),
    notes: r.notes ?? undefined,
    propertyName: r.propertyName ?? "Unknown",
  }));
  const data = ListReservationsResponse.parse(mapped);
  res.json(data);
});

router.post("/reservations", async (req, res) => {
  const body = CreateReservationBody.parse(req.body);
  const checkInStr = body.checkIn instanceof Date ? body.checkIn.toISOString().split("T")[0] : String(body.checkIn);
  const checkOutStr = body.checkOut instanceof Date ? body.checkOut.toISOString().split("T")[0] : String(body.checkOut);
  const [reservation] = await db.insert(reservationsTable).values({
    propertyId: body.propertyId,
    guestName: body.guestName,
    checkIn: checkInStr,
    checkOut: checkOutStr,
    totalAmount: String(body.totalAmount),
    status: body.status ?? "pending",
    notes: body.notes ?? null,
  }).returning();
  res.status(201).json({
    ...reservation,
    checkIn: new Date(reservation.checkIn),
    checkOut: new Date(reservation.checkOut),
    totalAmount: Number(reservation.totalAmount),
    notes: reservation.notes ?? undefined,
  });
});

export default router;
