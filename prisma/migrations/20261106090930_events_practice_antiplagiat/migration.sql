-- CreateEnum
CREATE TYPE "CheckStatus" AS ENUM ('QUEUED', 'DONE');

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "time" TEXT,
    "place" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticePeriod" (
    "id" SERIAL NOT NULL,
    "facultyId" INTEGER NOT NULL,
    "programId" INTEGER,
    "level" "Level" NOT NULL,
    "course" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "docsDeadline" DATE,
    "note" TEXT,

    CONSTRAINT "PracticePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AntiplagiatCheck" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "workTitle" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" "CheckStatus" NOT NULL DEFAULT 'QUEUED',
    "originality" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedAt" TIMESTAMP(3),

    CONSTRAINT "AntiplagiatCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_url_key" ON "Event"("url");

-- CreateIndex
CREATE INDEX "PracticePeriod_facultyId_level_course_idx" ON "PracticePeriod"("facultyId", "level", "course");

-- AddForeignKey
ALTER TABLE "PracticePeriod" ADD CONSTRAINT "PracticePeriod_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticePeriod" ADD CONSTRAINT "PracticePeriod_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AntiplagiatCheck" ADD CONSTRAINT "AntiplagiatCheck_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
