ALTER TABLE "contexts" RENAME COLUMN "application" TO "applicationName";

ALTER INDEX "contexts_environmentId_application_key_key" RENAME TO "contexts_environmentId_applicationName_key_key";
