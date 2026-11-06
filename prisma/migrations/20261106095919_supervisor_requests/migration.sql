-- CreateEnum
CREATE TYPE "SupervisionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "SupervisorProfile" (
    "personId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "degree" TEXT,
    "interests" TEXT NOT NULL,
    "maxStudents" INTEGER NOT NULL DEFAULT 5,
    "levels" "Level"[],

    CONSTRAINT "SupervisorProfile_pkey" PRIMARY KEY ("personId")
);

-- CreateTable
CREATE TABLE "SupervisorRequest" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SupervisionStatus" NOT NULL DEFAULT 'PENDING',
    "reply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "SupervisorRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupervisorRequest_supervisorId_status_idx" ON "SupervisorRequest"("supervisorId", "status");

-- CreateIndex
CREATE INDEX "SupervisorRequest_enrollmentId_status_idx" ON "SupervisorRequest"("enrollmentId", "status");

-- AddForeignKey
ALTER TABLE "SupervisorProfile" ADD CONSTRAINT "SupervisorProfile_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorRequest" ADD CONSTRAINT "SupervisorRequest_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorRequest" ADD CONSTRAINT "SupervisorRequest_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
