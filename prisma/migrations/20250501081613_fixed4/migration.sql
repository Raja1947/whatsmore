/*
  Warnings:

  - A unique constraint covering the columns `[url]` on the table `uploadedFile` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "uploadedFile_url_key" ON "uploadedFile"("url");
