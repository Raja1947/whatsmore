-- CreateTable
CREATE TABLE "uploadedFile" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploadedFile_pkey" PRIMARY KEY ("id")
);
