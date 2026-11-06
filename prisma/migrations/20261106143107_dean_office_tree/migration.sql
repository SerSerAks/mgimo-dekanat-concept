-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "isHead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "managerId" TEXT,
ADD COLUMN     "position" TEXT,
ADD COLUMN     "staffDuties" TEXT,
ADD COLUMN     "staffHours" TEXT,
ADD COLUMN     "staffRoom" TEXT,
ADD COLUMN     "workPhone" TEXT;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

