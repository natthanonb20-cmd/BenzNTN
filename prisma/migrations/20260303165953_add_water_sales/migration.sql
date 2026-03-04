-- CreateTable
CREATE TABLE "WaterSale" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "smallPacks" INTEGER NOT NULL DEFAULT 0,
    "largePacks" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "invoiceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaterSale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaterSale_tenantId_idx" ON "WaterSale"("tenantId");

-- CreateIndex
CREATE INDEX "WaterSale_saleDate_idx" ON "WaterSale"("saleDate");

-- CreateIndex
CREATE INDEX "WaterSale_isPaid_idx" ON "WaterSale"("isPaid");

-- AddForeignKey
ALTER TABLE "WaterSale" ADD CONSTRAINT "WaterSale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterSale" ADD CONSTRAINT "WaterSale_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
