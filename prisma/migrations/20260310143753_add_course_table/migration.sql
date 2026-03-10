-- CreateTable
CREATE TABLE "Internship" (
    "internship_id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "location" VARCHAR(255) NOT NULL,
    "duration" INTEGER NOT NULL,
    "stipend" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Internship_pkey" PRIMARY KEY ("internship_id")
);
