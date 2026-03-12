import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { propertiesTable } from "@workspace/db/schema";
import { CreatePropertyBody, ListPropertiesResponse, GetPropertyParams, GetPropertyResponse } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/properties", async (_req, res) => {
  const properties = await db.select().from(propertiesTable).orderBy(propertiesTable.createdAt);
  const mapped = properties.map((p) => ({
    ...p,
    monthlyRent: Number(p.monthlyRent),
    imageUrl: p.imageUrl ?? undefined,
  }));
  const data = ListPropertiesResponse.parse(mapped);
  res.json(data);
});

router.get("/properties/:id", async (req, res) => {
  const { id } = GetPropertyParams.parse({ id: req.params.id });
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!property) {
    res.status(404).json({ message: "Property not found" });
    return;
  }
  const data = GetPropertyResponse.parse({
    ...property,
    monthlyRent: Number(property.monthlyRent),
    imageUrl: property.imageUrl ?? undefined,
  });
  res.json(data);
});

router.post("/properties", async (req, res) => {
  const body = CreatePropertyBody.parse(req.body);
  const [property] = await db.insert(propertiesTable).values({
    name: body.name,
    address: body.address,
    type: body.type,
    bedrooms: body.bedrooms,
    bathrooms: body.bathrooms,
    monthlyRent: String(body.monthlyRent),
    status: body.status ?? "available",
    imageUrl: body.imageUrl ?? null,
  }).returning();
  res.status(201).json({
    ...property,
    monthlyRent: Number(property.monthlyRent),
    imageUrl: property.imageUrl ?? undefined,
  });
});

export default router;
