import { getDatabase } from "./database";
import { logger } from "./logger";

export interface SavedFace {
  id: string;
  user_id: string;
  name: string;
  magic_hour_path: string;
  thumbnail_url: string | null;
  uploaded_at: number;
  usage_count: number;
}

const MAX_FACES_PER_USER = 3;

/**
 * Get all saved faces for a user
 */
export function getUserFaces(userId: string): SavedFace[] {
  const db = getDatabase();
  const stmt = db.prepare(
    "SELECT * FROM saved_faces WHERE user_id = ? ORDER BY uploaded_at DESC"
  );
  return stmt.all(userId) as SavedFace[];
}

/**
 * Get a specific saved face by ID
 */
export function getFaceById(faceId: string, userId: string): SavedFace | null {
  const db = getDatabase();
  const stmt = db.prepare(
    "SELECT * FROM saved_faces WHERE id = ? AND user_id = ?"
  );
  const face = stmt.get(faceId, userId) as SavedFace | undefined;
  return face || null;
}

/**
 * Save a new face for a user
 * @returns The saved face or null if limit reached
 */
export function saveFace(
  userId: string,
  name: string,
  magicHourPath: string,
  thumbnailUrl?: string
): SavedFace | null {
  const db = getDatabase();

  // Check if user has reached limit
  const existingFaces = getUserFaces(userId);
  if (existingFaces.length >= MAX_FACES_PER_USER) {
    return null; // Limit reached
  }

  // Generate unique ID
  const faceId = `face_${userId}_${Date.now()}`;

  // Insert new face
  const stmt = db.prepare(`
    INSERT INTO saved_faces (id, user_id, name, magic_hour_path, thumbnail_url, uploaded_at, usage_count)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `);

  stmt.run(faceId, userId, name, magicHourPath, thumbnailUrl || null, Date.now());

  logger.info("FaceStorage", "Saved face for user", {
    userId,
    name,
    faceId,
  });

  return getFaceById(faceId, userId);
}

/**
 * Delete a saved face
 */
export function deleteFace(faceId: string, userId: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare(
    "DELETE FROM saved_faces WHERE id = ? AND user_id = ?"
  );
  const result = stmt.run(faceId, userId);

  if (result.changes > 0) {
    logger.info("FaceStorage", "Deleted face for user", { faceId, userId });
    return true;
  }

  return false;
}

/**
 * Increment usage count for a face
 */
export function incrementFaceUsage(faceId: string, userId: string): void {
  const db = getDatabase();
  const stmt = db.prepare(
    "UPDATE saved_faces SET usage_count = usage_count + 1 WHERE id = ? AND user_id = ?"
  );
  stmt.run(faceId, userId);
}

/**
 * Check if user can save more faces
 */
export function canSaveMoreFaces(userId: string): boolean {
  const faces = getUserFaces(userId);
  return faces.length < MAX_FACES_PER_USER;
}

/**
 * Get remaining face slots for user
 */
export function getRemainingFaceSlots(userId: string): number {
  const faces = getUserFaces(userId);
  return Math.max(0, MAX_FACES_PER_USER - faces.length);
}

/**
 * Update face name
 */
export function updateFaceName(
  faceId: string,
  userId: string,
  newName: string
): boolean {
  const db = getDatabase();
  const stmt = db.prepare(
    "UPDATE saved_faces SET name = ? WHERE id = ? AND user_id = ?"
  );
  const result = stmt.run(newName, faceId, userId);
  return result.changes > 0;
}

