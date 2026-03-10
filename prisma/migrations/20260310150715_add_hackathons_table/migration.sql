-- CreateTable
CREATE TABLE "Hackathon" (
    "hackathon_id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "organizer" VARCHAR(255) NOT NULL,
    "location" VARCHAR(255) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hackathon_pkey" PRIMARY KEY ("hackathon_id")
);
