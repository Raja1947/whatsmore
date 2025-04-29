/*
  Warnings:

  - You are about to drop the column `productId` on the `ProductTimestamp` table. All the data in the column will be lost.
  - Added the required column `variantId` to the `ProductTimestamp` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ProductTimestamp" DROP COLUMN "productId",
ADD COLUMN     "variantId" TEXT NOT NULL;
