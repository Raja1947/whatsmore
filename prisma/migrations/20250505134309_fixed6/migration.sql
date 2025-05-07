/*
  Warnings:

  - Added the required column `duration` to the `uploadedFile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "uploadedFile" ADD COLUMN     "duration" INTEGER NOT NULL;
