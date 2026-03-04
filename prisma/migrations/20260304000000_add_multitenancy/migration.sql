-- ============================================================
-- Migration: add_multitenancy
-- สร้าง Property, User, Subscription, PropertySetting
-- และผูกข้อมูลเดิมเข้ากับ Default Property
-- ============================================================

-- Enums ใหม่
CREATE TYPE "UserRole" AS ENUM ('MASTER_ADMIN', 'PROPERTY_ADMIN');
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE_TRIAL', 'STARTER', 'STANDARD', 'PROFESSIONAL', 'ENTERPRISE');

-- ── Property ──────────────────────────────────────────────
CREATE TABLE "Property" (
    "id"                     TEXT NOT NULL,
    "name"                   TEXT NOT NULL,
    "ownerName"              TEXT,
    "phone"                  TEXT,
    "address"                TEXT,
    "isActive"               BOOLEAN NOT NULL DEFAULT true,
    "lineChannelAccessToken" TEXT,
    "lineChannelSecret"      TEXT,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- ── User ──────────────────────────────────────────────────
CREATE TABLE "User" (
    "id"         TEXT NOT NULL,
    "propertyId" TEXT,
    "username"   TEXT NOT NULL,
    "password"   TEXT NOT NULL,
    "role"       "UserRole" NOT NULL DEFAULT 'PROPERTY_ADMIN',
    "isActive"   BOOLEAN NOT NULL DEFAULT true,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_propertyId_idx" ON "User"("propertyId");

-- ── Subscription ──────────────────────────────────────────
CREATE TABLE "Subscription" (
    "id"         TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "plan"       "SubscriptionPlan" NOT NULL DEFAULT 'FREE_TRIAL',
    "roomLimit"  INTEGER NOT NULL DEFAULT 10,
    "startDate"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"  TIMESTAMP(3),
    "isActive"   BOOLEAN NOT NULL DEFAULT true,
    "note"       TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Subscription_propertyId_key" ON "Subscription"("propertyId");

-- ── PropertySetting ───────────────────────────────────────
CREATE TABLE "PropertySetting" (
    "id"         TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "key"        TEXT NOT NULL,
    "value"      TEXT NOT NULL,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertySetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PropertySetting_propertyId_key_key" ON "PropertySetting"("propertyId", "key");
CREATE INDEX "PropertySetting_propertyId_idx" ON "PropertySetting"("propertyId");

-- ── สร้าง Default Property สำหรับข้อมูลเดิม ─────────────
INSERT INTO "Property" ("id", "name", "ownerName", "isActive", "createdAt", "updatedAt")
VALUES ('default_property_001', 'หอพักหลัก', 'เจ้าของหอพัก', true, NOW(), NOW());

-- ── Default Subscription ──────────────────────────────────
INSERT INTO "Subscription" ("id", "propertyId", "plan", "roomLimit", "startDate", "isActive", "createdAt", "updatedAt")
VALUES ('default_sub_001', 'default_property_001', 'PROFESSIONAL', 100, NOW(), true, NOW(), NOW());

-- ── Default PropertySettings ──────────────────────────────
INSERT INTO "PropertySetting" ("id", "propertyId", "key", "value", "updatedAt") VALUES
    ('ps_elec_001',  'default_property_001', 'electricRate', '8',  NOW()),
    ('ps_water_001', 'default_property_001', 'waterRate',    '18', NOW());

-- ── เพิ่ม propertyId (nullable ก่อน) ──────────────────────
ALTER TABLE "Room"         ADD COLUMN "propertyId" TEXT;
ALTER TABLE "Tenant"       ADD COLUMN "propertyId" TEXT;
ALTER TABLE "WaitingQueue" ADD COLUMN "propertyId" TEXT;
ALTER TABLE "WaterSale"    ADD COLUMN "propertyId" TEXT;

-- ── ผูกข้อมูลเดิมทั้งหมดกับ Default Property ─────────────
UPDATE "Room"         SET "propertyId" = 'default_property_001' WHERE "propertyId" IS NULL;
UPDATE "Tenant"       SET "propertyId" = 'default_property_001' WHERE "propertyId" IS NULL;
UPDATE "WaitingQueue" SET "propertyId" = 'default_property_001' WHERE "propertyId" IS NULL;
UPDATE "WaterSale"    SET "propertyId" = 'default_property_001' WHERE "propertyId" IS NULL;

-- ── ตั้งค่า NOT NULL หลังจาก populate ────────────────────
ALTER TABLE "Room"         ALTER COLUMN "propertyId" SET NOT NULL;
ALTER TABLE "Tenant"       ALTER COLUMN "propertyId" SET NOT NULL;
ALTER TABLE "WaitingQueue" ALTER COLUMN "propertyId" SET NOT NULL;
ALTER TABLE "WaterSale"    ALTER COLUMN "propertyId" SET NOT NULL;

-- ── เพิ่ม Indexes + ปรับ Unique Constraints ───────────────
CREATE INDEX "Room_propertyId_idx"         ON "Room"("propertyId");
CREATE INDEX "Tenant_propertyId_idx"       ON "Tenant"("propertyId");
CREATE INDEX "WaitingQueue_propertyId_idx" ON "WaitingQueue"("propertyId");
CREATE INDEX "WaterSale_propertyId_idx"    ON "WaterSale"("propertyId");

-- Room: roomNumber unique per property (drop old global unique)
DROP INDEX IF EXISTS "Room_roomNumber_key";
CREATE UNIQUE INDEX "Room_propertyId_roomNumber_key" ON "Room"("propertyId", "roomNumber");

-- Tenant: lineUserId unique per property
DROP INDEX IF EXISTS "Tenant_lineUserId_key";
CREATE UNIQUE INDEX "Tenant_propertyId_lineUserId_key" ON "Tenant"("propertyId", "lineUserId")
    WHERE "lineUserId" IS NOT NULL;

-- WaitingQueue: queueNumber unique per property
DROP INDEX IF EXISTS "WaitingQueue_queueNumber_key";
CREATE UNIQUE INDEX "WaitingQueue_propertyId_queueNumber_key" ON "WaitingQueue"("propertyId", "queueNumber");

-- ── FK Constraints ────────────────────────────────────────
ALTER TABLE "User"            ADD CONSTRAINT "User_propertyId_fkey"            FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Subscription"    ADD CONSTRAINT "Subscription_propertyId_fkey"    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertySetting" ADD CONSTRAINT "PropertySetting_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Room"            ADD CONSTRAINT "Room_propertyId_fkey"            FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Tenant"          ADD CONSTRAINT "Tenant_propertyId_fkey"          FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WaitingQueue"    ADD CONSTRAINT "WaitingQueue_propertyId_fkey"    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WaterSale"       ADD CONSTRAINT "WaterSale_propertyId_fkey"       FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
