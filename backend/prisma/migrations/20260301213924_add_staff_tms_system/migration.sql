-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('GENERAL_MANAGER', 'HEAD_OF_DEPT', 'SUPERVISOR', 'LINE_STAFF', 'RECEPTIONIST');

-- CreateEnum
CREATE TYPE "StaffDepartment" AS ENUM ('HOUSEKEEPING', 'MAINTENANCE', 'FOOD_AND_BEVERAGE', 'FRONT_OFFICE', 'SECURITY', 'MANAGEMENT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'INSPECTED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "assignedStaffId" TEXT,
ADD COLUMN     "estimatedMinutes" INTEGER,
ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "staffNote" TEXT,
ADD COLUMN     "tmsTaskId" TEXT;

-- AlterTable
ALTER TABLE "service_requests" ADD COLUMN     "assignedStaffId" TEXT,
ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "staffNote" TEXT,
ADD COLUMN     "tmsTaskId" TEXT;

-- CreateTable
CREATE TABLE "staff_members" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "role" "StaffRole" NOT NULL,
    "department" "StaffDepartment" NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "pin" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "avatarUrl" TEXT,
    "fcmToken" TEXT,
    "assignedFloor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_shifts" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "staff_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_tasks" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "department" "StaffDepartment" NOT NULL,
    "locationLabel" TEXT,
    "roomNumber" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TaskStatus" NOT NULL DEFAULT 'NEW',
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "templateId" TEXT,
    "slaMinutes" INTEGER,
    "dueAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "holdReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_templates" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" "StaffDepartment" NOT NULL,
    "defaultPriority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "slaMinutes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_checklists" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "completedItems" JSONB NOT NULL DEFAULT '{}',
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_attachments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_members_hotelId_isActive_idx" ON "staff_members"("hotelId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_hotelId_email_key" ON "staff_members"("hotelId", "email");

-- CreateIndex
CREATE INDEX "staff_shifts_hotelId_isActive_idx" ON "staff_shifts"("hotelId", "isActive");

-- CreateIndex
CREATE INDEX "internal_tasks_hotelId_status_idx" ON "internal_tasks"("hotelId", "status");

-- CreateIndex
CREATE INDEX "internal_tasks_hotelId_department_idx" ON "internal_tasks"("hotelId", "department");

-- CreateIndex
CREATE INDEX "internal_tasks_assignedToId_idx" ON "internal_tasks"("assignedToId");

-- CreateIndex
CREATE INDEX "task_templates_hotelId_isActive_idx" ON "task_templates"("hotelId", "isActive");

-- CreateIndex
CREATE INDEX "checklist_items_templateId_idx" ON "checklist_items"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "task_checklists_taskId_key" ON "task_checklists"("taskId");

-- CreateIndex
CREATE INDEX "task_attachments_taskId_taskType_idx" ON "task_attachments"("taskId", "taskType");

-- CreateIndex
CREATE INDEX "task_comments_taskId_taskType_idx" ON "task_comments"("taskId", "taskType");

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_shifts" ADD CONSTRAINT "staff_shifts_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_tasks" ADD CONSTRAINT "internal_tasks_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_tasks" ADD CONSTRAINT "internal_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_tasks" ADD CONSTRAINT "internal_tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_tasks" ADD CONSTRAINT "internal_tasks_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "task_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "task_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_checklists" ADD CONSTRAINT "task_checklists_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "internal_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
