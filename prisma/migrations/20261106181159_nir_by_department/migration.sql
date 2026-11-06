-- DropIndex
DROP INDEX "SupervisionCampaign_facultyId_programId_level_course_workTy_key";

-- AlterTable
ALTER TABLE "SupervisionCampaign" ADD COLUMN     "departmentId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "SupervisionCampaign_facultyId_departmentId_programId_level__key" ON "SupervisionCampaign"("facultyId", "departmentId", "programId", "level", "course", "workType", "academicYear");

-- AddForeignKey
ALTER TABLE "SupervisionCampaign" ADD CONSTRAINT "SupervisionCampaign_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

