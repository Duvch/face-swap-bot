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
export function getUserPreferences(userId: string): UserPreferences {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM user_preferences WHERE user_id = ?");
  // Database returns auto_save_faces as INTEGER (0 or 1), not boolean
  const prefs = stmt.get(userId) as
    | {
        user_id: string;
        default_face_id: string | null;
        auto_save_faces: number; // INTEGER in database
        max_gif_duration: number;
        created_at: number;
        updated_at: number;
      }
    | undefined;

  if (!prefs) {
    // Create default preferences
    return createDefaultPreferences(userId);
  }

  // Convert auto_save_faces from integer to boolean
  return {
    user_id: prefs.user_id,
    default_face_id: prefs.default_face_id,
    auto_save_faces: prefs.auto_save_faces === 1,
    max_gif_duration: prefs.max_gif_duration,
    created_at: prefs.created_at,
    updated_at: prefs.updated_at,
  };
}

/**
 * Create default preferences for a user
 */
function createDefaultPreferences(userId: string): UserPreferences {
  const db = getDatabase();
  const now = Date.now();

  const stmt = db.prepare(`
    INSERT INTO user_preferences (user_id, default_face_id, auto_save_faces, max_gif_duration, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    userId,
    null,
    0, // false
    DEFAULT_PREFERENCES.max_gif_duration,
    now,
    now
  );

  return {
    user_id: userId,
    ...DEFAULT_PREFERENCES,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Update user preferences
 */
export function updateUserPreferences(
  userId: string,
  updates: Partial<Omit<UserPreferences, "user_id" | "created_at">>
): UserPreferences {
  const db = getDatabase();
  const now = Date.now();

  // Get current preferences
  const current = getUserPreferences(userId);

  // Build update query
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.default_face_id !== undefined) {
    fields.push("default_face_id = ?");
    values.push(updates.default_face_id);
  }

  if (updates.auto_save_faces !== undefined) {
    fields.push("auto_save_faces = ?");
    values.push(updates.auto_save_faces ? 1 : 0);
  }

  if (updates.max_gif_duration !== undefined) {
    // Validate range
    const duration = Math.max(1, Math.min(30, updates.max_gif_duration));
    fields.push("max_gif_duration = ?");
    values.push(duration);
  }

  if (fields.length === 0) {
    return current; // No updates
  }

  fields.push("updated_at = ?");
  values.push(now);
  values.push(userId);

  const stmt = db.prepare(`
    UPDATE user_preferences
    SET ${fields.join(", ")}
    WHERE user_id = ?
  `);

  stmt.run(...values);

  logger.info("UserPreferences", "Updated preferences for user", {
    userId,
    fields: Object.keys(updates),
  });

  // Return updated preferences
  const updated = getUserPreferences(userId);
  const dbUpdated = updated as any;
  return {
    ...updated,
    auto_save_faces: dbUpdated.auto_save_faces === 1,
  };
}

/**
 * Set default face
 */
export function setDefaultFace(userId: string, faceId: string | null): boolean {
  updateUserPreferences(userId, { default_face_id: faceId });
  return true;
}

/**
 * Toggle auto-save faces
 */
export function setAutoSaveFaces(userId: string, enabled: boolean): boolean {
  updateUserPreferences(userId, { auto_save_faces: enabled });
  return true;
}

/**
 * Set max GIF duration
 */
export function setMaxGifDuration(userId: string, duration: number): boolean {
  const clamped = Math.max(1, Math.min(30, duration));
  updateUserPreferences(userId, { max_gif_duration: clamped });
  return true;
}
