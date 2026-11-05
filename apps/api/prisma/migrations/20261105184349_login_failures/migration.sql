-- CreateTable
CREATE TABLE "login_failures" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "login_failures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_failures_key_at_idx" ON "login_failures"("key", "at");

-- CreateIndex
CREATE INDEX "login_failures_at_idx" ON "login_failures"("at");
