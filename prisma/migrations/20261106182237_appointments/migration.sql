-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "lastAppointmentId" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "appointmentId" TEXT;

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "staffDepartmentId" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Appointment_role_staffDepartmentId_idx" ON "Appointment"("role", "staffDepartmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_personId_role_staffDepartmentId_key" ON "Appointment"("personId", "role", "staffDepartmentId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_staffDepartmentId_fkey" FOREIGN KEY ("staffDepartmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

