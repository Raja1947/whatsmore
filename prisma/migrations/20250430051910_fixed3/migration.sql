/*
  Warnings:

  - You are about to drop the `ProductTimestamp` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProductTimestamp" DROP CONSTRAINT "ProductTimestamp_uploadedFileId_fkey";

-- DropTable
DROP TABLE "ProductTimestamp";

-- CreateTable
CREATE TABLE "SelectedProduct" (
    "id" SERIAL NOT NULL,
    "uploadedFileId" INTEGER NOT NULL,
    "variantId" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,

    CONSTRAINT "SelectedProduct_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SelectedProduct" ADD CONSTRAINT "SelectedProduct_uploadedFileId_fkey" FOREIGN KEY ("uploadedFileId") REFERENCES "uploadedFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
