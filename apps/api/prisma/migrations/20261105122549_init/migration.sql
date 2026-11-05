-- CreateEnum
CREATE TYPE "issue_status" AS ENUM ('new', 'unassigned', 'assigned', 'sent', 'estimated', 'in_progress', 'solved', 'cancelled');

-- CreateEnum
CREATE TYPE "priority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "photo_kind" AS ENUM ('before', 'after');

-- CreateEnum
CREATE TYPE "locale" AS ENUM ('ar', 'en');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locale" "locale" NOT NULL DEFAULT 'ar',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "address" TEXT,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "next_number" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "name_en" TEXT,
    "color" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_categories" (
    "worker_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "worker_categories_pkey" PRIMARY KEY ("worker_id","category_id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "issue_status" NOT NULL DEFAULT 'new',
    "priority" "priority" NOT NULL DEFAULT 'normal',
    "description" TEXT,
    "location" TEXT,
    "category_id" UUID,
    "worker_id" UUID,
    "estimated_date" DATE,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "assigned_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "solved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" UUID NOT NULL,
    "issue_id" UUID NOT NULL,
    "kind" "photo_kind" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_changes" (
    "id" UUID NOT NULL,
    "issue_id" UUID NOT NULL,
    "from" "issue_status",
    "to" "issue_status" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "sites_name_key_idx" ON "sites"("name_key");

-- CreateIndex
CREATE INDEX "sites_archived_idx" ON "sites"("archived");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key_key" ON "categories"("name_key");

-- CreateIndex
CREATE INDEX "categories_active_sort_order_idx" ON "categories"("active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "workers_phone_key" ON "workers"("phone");

-- CreateIndex
CREATE INDEX "workers_active_idx" ON "workers"("active");

-- CreateIndex
CREATE INDEX "workers_name_idx" ON "workers"("name");

-- CreateIndex
CREATE INDEX "worker_categories_category_id_idx" ON "worker_categories"("category_id");

-- CreateIndex
CREATE INDEX "issues_site_id_status_idx" ON "issues"("site_id", "status");

-- CreateIndex
CREATE INDEX "issues_status_idx" ON "issues"("status");

-- CreateIndex
CREATE INDEX "issues_category_id_idx" ON "issues"("category_id");

-- CreateIndex
CREATE INDEX "issues_worker_id_status_idx" ON "issues"("worker_id", "status");

-- CreateIndex
CREATE INDEX "issues_priority_idx" ON "issues"("priority");

-- CreateIndex
CREATE INDEX "issues_estimated_date_idx" ON "issues"("estimated_date");

-- CreateIndex
CREATE INDEX "issues_captured_at_idx" ON "issues"("captured_at");

-- CreateIndex
CREATE INDEX "issues_solved_at_idx" ON "issues"("solved_at");

-- CreateIndex
CREATE UNIQUE INDEX "issues_site_id_number_key" ON "issues"("site_id", "number");

-- CreateIndex
CREATE INDEX "photos_issue_id_kind_sort_order_idx" ON "photos"("issue_id", "kind", "sort_order");

-- CreateIndex
CREATE INDEX "status_changes_issue_id_created_at_idx" ON "status_changes"("issue_id", "created_at");

-- CreateIndex
CREATE INDEX "status_changes_created_at_idx" ON "status_changes"("created_at");

-- AddForeignKey
ALTER TABLE "worker_categories" ADD CONSTRAINT "worker_categories_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_categories" ADD CONSTRAINT "worker_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_changes" ADD CONSTRAINT "status_changes_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Guards Prisma can't express (added by hand; see the header of schema.prisma).
ALTER TABLE "sites" ADD CONSTRAINT "sites_next_number_positive" CHECK ("next_number" >= 1);
ALTER TABLE "issues" ADD CONSTRAINT "issues_number_positive" CHECK ("number" >= 1);
ALTER TABLE "categories" ADD CONSTRAINT "categories_color_hex" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE "photos" ADD CONSTRAINT "photos_size_positive" CHECK ("width" > 0 AND "height" > 0);
ALTER TABLE "photos" ADD CONSTRAINT "photos_sort_order_non_negative" CHECK ("sort_order" >= 0);
