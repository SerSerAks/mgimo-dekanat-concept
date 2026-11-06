-- CreateTable
CREATE TABLE "FacultyPosition" (
    "id" SERIAL NOT NULL,
    "facultyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FacultyPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FacultyPosition_facultyId_name_key" ON "FacultyPosition"("facultyId", "name");

-- AddForeignKey
ALTER TABLE "FacultyPosition" ADD CONSTRAINT "FacultyPosition_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

