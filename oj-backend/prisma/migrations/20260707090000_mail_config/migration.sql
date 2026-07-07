CREATE TABLE "mail_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL DEFAULT 'gmail',
    "from" TEXT NOT NULL,
    "smtpUser" TEXT NOT NULL,
    "smtpPass" TEXT NOT NULL,
    "smtpHost" TEXT DEFAULT 'smtp.gmail.com',
    "smtpPort" INTEGER NOT NULL DEFAULT 587,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_config_pkey" PRIMARY KEY ("id")
);
