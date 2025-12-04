-- CreateTable
CREATE TABLE "saved_faces" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "magic_hour_path" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "uploaded_at" BIGINT NOT NULL,
    "usage_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "saved_faces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "user_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "timestamps" TEXT NOT NULL,
    "updated_at" BIGINT NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("user_id","action_type")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "user_id" TEXT NOT NULL,
    "default_face_id" TEXT,
    "auto_save_faces" BOOLEAN NOT NULL DEFAULT false,
    "max_gif_duration" INTEGER NOT NULL DEFAULT 20,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "swap_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "swap_type" TEXT NOT NULL,
    "credits_used" INTEGER NOT NULL,
    "created_at" BIGINT NOT NULL,

    CONSTRAINT "swap_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_faces_user_id_idx" ON "saved_faces"("user_id");

-- CreateIndex
CREATE INDEX "swap_history_user_id_idx" ON "swap_history"("user_id");

-- CreateIndex
CREATE INDEX "swap_history_created_at_idx" ON "swap_history"("created_at");
