-- CreateTable
CREATE TABLE "IncidentAnalysis" (
    "id" SERIAL NOT NULL,
    "orgId" INTEGER NOT NULL,
    "incidentId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "incidentStatus" TEXT NOT NULL,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IncidentAnalysis_incidentId_key" ON "IncidentAnalysis"("incidentId");

-- CreateIndex
CREATE INDEX "IncidentAnalysis_orgId_idx" ON "IncidentAnalysis"("orgId");

-- AddForeignKey
ALTER TABLE "IncidentAnalysis" ADD CONSTRAINT "IncidentAnalysis_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
