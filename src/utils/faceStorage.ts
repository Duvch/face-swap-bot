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
export async function getUserFaces(userId: string): Promise<SavedFace[]> {
  const db = getDatabase();
  const faces = await db.savedFace.findMany({
    where: { userId },
    orderBy: { uploadedAt: "desc" },
  });

  // Convert BigInt to number for compatibility
  return faces.map((face) => ({
    id: face.id,
    user_id: face.userId,
    name: face.name,
    magic_hour_path: face.magicHourPath,
    thumbnail_url: face.thumbnailUrl,
    uploaded_at: Number(face.uploadedAt),
    usage_count: face.usageCount,
  }));
}

/**
 * Get a specific saved face by ID
 */
export async function getFaceById(
  faceId: string,
  userId: string,
): Promise<SavedFace | null> {
  const db = getDatabase();
  const face = await db.savedFace.findUnique({
    where: {
      id: faceId,
    },
  });

  if (!face || face.userId !== userId) {
    return null;
  }

  return {
    id: face.id,
    user_id: face.userId,
    name: face.name,
    magic_hour_path: face.magicHourPath,
    thumbnail_url: face.thumbnailUrl,
    uploaded_at: Number(face.uploadedAt),
    usage_count: face.usageCount,
  };
}

/**
 * Save a new face for a user
 * @returns The saved face or null if limit reached
 */
export async function saveFace(
  userId: string,
  name: string,
  magicHourPath: string,
  thumbnailUrl?: string,
): Promise<SavedFace | null> {
  const db = getDatabase();

  // Check if user has reached limit
  const existingFaces = await getUserFaces(userId);
  if (existingFaces.length >= MAX_FACES_PER_USER) {
    return null; // Limit reached
  }

  // Generate unique ID
  const faceId = `face_${userId}_${Date.now()}`;
  const now = BigInt(Date.now());

  // Insert new face
  const face = await db.savedFace.create({
    data: {
      id: faceId,
      userId,
      name,
      magicHourPath,
      thumbnailUrl: thumbnailUrl || null,
      uploadedAt: now,
      usageCount: 0,
    },
  });

  logger.info("FaceStorage", "Saved face for user", {
    userId,
    name,
    faceId,
  });

  return {
    id: face.id,
    user_id: face.userId,
    name: face.name,
    magic_hour_path: face.magicHourPath,
    thumbnail_url: face.thumbnailUrl,
    uploaded_at: Number(face.uploadedAt),
    usage_count: face.usageCount,
  };
}

/**
 * Delete a saved face
 */
export async function deleteFace(
  faceId: string,
  userId: string,
): Promise<boolean> {
  const db = getDatabase();

  try {
    const result = await db.savedFace.deleteMany({
      where: {
        id: faceId,
        userId: userId,
      },
    });

    if (result.count > 0) {
      logger.info("FaceStorage", "Deleted face for user", { faceId, userId });
      return true;
    }

    return false;
  } catch (error) {
    logger.error(
      "FaceStorage",
      "Error deleting face",
      { faceId, userId },
      error as Error,
    );
    return false;
  }
}

/**
 * Increment usage count for a face
 */
export async function incrementFaceUsage(
  faceId: string,
  userId: string,
): Promise<void> {
  const db = getDatabase();

  await db.savedFace.updateMany({
    where: {
      id: faceId,
      userId: userId,
    },
    data: {
      usageCount: {
        increment: 1,
      },
    },
  });
}

/**
 * Check if user can save more faces
 */
export async function canSaveMoreFaces(userId: string): Promise<boolean> {
  const faces = await getUserFaces(userId);
  return faces.length < MAX_FACES_PER_USER;
}

/**
 * Get remaining face slots for user
 */
export async function getRemainingFaceSlots(userId: string): Promise<number> {
  const faces = await getUserFaces(userId);
  return Math.max(0, MAX_FACES_PER_USER - faces.length);
}

/**
 * Update face name
 */
export async function updateFaceName(
  faceId: string,
  userId: string,
  newName: string,
): Promise<boolean> {
  const db = getDatabase();

  try {
    const result = await db.savedFace.updateMany({
      where: {
        id: faceId,
        userId: userId,
      },
      data: {
        name: newName,
      },
    });

    return result.count > 0;
  } catch (error) {
    logger.error(
      "FaceStorage",
      "Error updating face name",
      { faceId, userId },
      error as Error,
    );
    return false;
  }
}
