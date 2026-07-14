CREATE TABLE "site_banner" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "imagePath" TEXT,
    "linkUrl" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_banner_pkey" PRIMARY KEY ("id")
);
