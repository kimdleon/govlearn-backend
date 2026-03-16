-- CreateTable
CREATE TABLE "SignupVerification" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "verificationExpiry" TIMESTAMP(3) NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "country" TEXT,
    "company" TEXT,
    "jobRole" TEXT,
    "studentOrProfessional" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignupVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignupVerification_email_key" ON "SignupVerification"("email");
