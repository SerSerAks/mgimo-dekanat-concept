-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'RECTOR';

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "departmentId" INTEGER;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

