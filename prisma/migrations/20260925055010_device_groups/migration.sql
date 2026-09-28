-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "groupId" INTEGER;

-- CreateTable
CREATE TABLE "DeviceGroup" (
    "id" SERIAL NOT NULL,
    "orgId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeviceGroup_orgId_idx" ON "DeviceGroup"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceGroup_orgId_name_key" ON "DeviceGroup"("orgId", "name");

-- CreateIndex
CREATE INDEX "Device_groupId_idx" ON "Device"("groupId");

-- AddForeignKey
ALTER TABLE "DeviceGroup" ADD CONSTRAINT "DeviceGroup_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "DeviceGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
