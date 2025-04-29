-- AlterTable
ALTER TABLE "uploadedFile" ADD COLUMN     "selected" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProductTimestamp" (
    "id" SERIAL NOT NULL,
    "uploadedFileId" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,

    CONSTRAINT "ProductTimestamp_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProductTimestamp" ADD CONSTRAINT "ProductTimestamp_uploadedFileId_fkey" FOREIGN KEY ("uploadedFileId") REFERENCES "uploadedFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
