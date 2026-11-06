-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('COURSEWORK', 'THESIS', 'NIR');

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "dedupeKey" TEXT;

-- AlterTable
ALTER TABLE "SupervisorRequest" ADD COLUMN     "campaignId" INTEGER;

-- CreateTable
CREATE TABLE "SupervisionCampaign" (
    "id" SERIAL NOT NULL,
    "facultyId" INTEGER NOT NULL,
    "programId" INTEGER,
    "level" "Level" NOT NULL,
    "course" INTEGER NOT NULL,
    "workType" "WorkType" NOT NULL,
    "academicYear" TEXT NOT NULL,
    "openBy" DATE NOT NULL,
    "chooseBy" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupervisionCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisorIntake" (
    "supervisorId" TEXT NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "slots" INTEGER NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupervisorIntake_pkey" PRIMARY KEY ("supervisorId","campaignId")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupervisionCampaign_facultyId_programId_level_course_workTy_key" ON "SupervisionCampaign"("facultyId", "programId", "level", "course", "workType", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- AddForeignKey
ALTER TABLE "SupervisorRequest" ADD CONSTRAINT "SupervisorRequest_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SupervisionCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionCampaign" ADD CONSTRAINT "SupervisionCampaign_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionCampaign" ADD CONSTRAINT "SupervisionCampaign_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorIntake" ADD CONSTRAINT "SupervisorIntake_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorIntake" ADD CONSTRAINT "SupervisorIntake_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SupervisionCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

