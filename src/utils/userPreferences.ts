import { getDatabase } from "./database";
import { logger } from "./logger";

export interface UserPreferences {
  user_id: string;
  default_face_id: string | null;
  auto_save_faces: boolean;
  max_gif_duration: number;
  created_at: number;
  updated_at: number;
}

const DEFAULT_PREFERENCES: Omit<UserPreferences, "user_id"> = {
  default_face_id: null,
  auto_save_faces: false,
  max_gif_duration: 20,
  created_at: Date.now(),
  updated_at: Date.now(),
};

/**
 * Get user preferences (create defaults if not exists)
 */
export async function getUserPreferences(
  userId: string,
): Promise<UserPreferences> {
  const db = getDatabase();
  const prefs = await db.userPreference.findUnique({
    where: { userId },
  });

  if (!prefs) {
    // Create default preferences
    return await createDefaultPreferences(userId);
  }

  // Convert BigInt to number and return
  return {
    user_id: prefs.userId,
    default_face_id: prefs.defaultFaceId,
    auto_save_faces: prefs.autoSaveFaces,
    max_gif_duration: prefs.maxGifDuration,
    created_at: Number(prefs.createdAt),
    updated_at: Number(prefs.updatedAt),
  };
}

/**
 * Create default preferences for a user
 */
async function createDefaultPreferences(
  userId: string,
): Promise<UserPreferences> {
  const db = getDatabase();
  const now = BigInt(Date.now());

  const prefs = await db.userPreference.create({
    data: {
      userId,
      defaultFaceId: null,
      autoSaveFaces: false,
      maxGifDuration: DEFAULT_PREFERENCES.max_gif_duration,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    user_id: prefs.userId,
    default_face_id: prefs.defaultFaceId,
    auto_save_faces: prefs.autoSaveFaces,
    max_gif_duration: prefs.maxGifDuration,
    created_at: Number(prefs.createdAt),
    updated_at: Number(prefs.updatedAt),
  };
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(
  userId: string,
  updates: Partial<Omit<UserPreferences, "user_id" | "created_at">>,
): Promise<UserPreferences> {
  const db = getDatabase();
  const now = BigInt(Date.now());

  // Get current preferences (will create if not exists)
  await getUserPreferences(userId);

  // Prepare update data
  const updateData: any = {
    updatedAt: now,
  };

  if (updates.default_face_id !== undefined) {
    updateData.defaultFaceId = updates.default_face_id;
  }

  if (updates.auto_save_faces !== undefined) {
    updateData.autoSaveFaces = updates.auto_save_faces;
  }

  if (updates.max_gif_duration !== undefined) {
    // Validate range
    const duration = Math.max(1, Math.min(30, updates.max_gif_duration));
    updateData.maxGifDuration = duration;
  }

  // Update preferences
  const prefs = await db.userPreference.update({
    where: { userId },
    data: updateData,
  });

  logger.info("UserPreferences", "Updated preferences for user", {
    userId,
    fields: Object.keys(updates),
  });

  return {
    user_id: prefs.userId,
    default_face_id: prefs.defaultFaceId,
    auto_save_faces: prefs.autoSaveFaces,
    max_gif_duration: prefs.maxGifDuration,
    created_at: Number(prefs.createdAt),
    updated_at: Number(prefs.updatedAt),
  };
}

/**
 * Set default face
 */
export async function setDefaultFace(
  userId: string,
  faceId: string | null,
): Promise<boolean> {
  await updateUserPreferences(userId, { default_face_id: faceId });
  return true;
}

/**
 * Toggle auto-save faces
 */
export async function setAutoSaveFaces(
  userId: string,
  enabled: boolean,
): Promise<boolean> {
  await updateUserPreferences(userId, { auto_save_faces: enabled });
  return true;
}

/**
 * Set max GIF duration
 */
export async function setMaxGifDuration(
  userId: string,
  duration: number,
): Promise<boolean> {
  const clamped = Math.max(1, Math.min(30, duration));
  await updateUserPreferences(userId, { max_gif_duration: clamped });
  return true;
}
