import Client from "magic-hour";
import { FaceSwapResult, MagicHourError } from "../types";
import { logger } from "./logger";

let client: Client | null = null;
const CONTEXT = "MagicHour";

/**
 * Initialize the Magic Hour client with API key
 */
export function initializeMagicHour(apiKey: string): void {
  client = new Client({ token: apiKey });
  logger.info(CONTEXT, "Magic Hour client initialized");
}

/**
 * Get the Magic Hour client instance
 */
function getClient(): Client {
  if (!client) {
    throw new Error(
      "Magic Hour client not initialized. Call initializeMagicHour first."
    );
  }
  return client;
}

/**
 * Swap faces between source and target images
 * @param sourceFacePath - Magic Hour file path for source face
 * @param targetImagePath - Magic Hour file path for target image
 * @returns Face swap result with download URL and credits charged
 */
export async function swapFaces(
  sourceFacePath: string,
  targetImagePath: string
): Promise<FaceSwapResult> {
  const magicHourClient = getClient();

  try {
    logger.info(CONTEXT, "Starting face swap", {
      sourceFacePath,
      targetImagePath,
    });

    // Use .create() instead of .generate() to avoid re-uploading
    const createResponse = await magicHourClient.v1.faceSwapPhoto.create({
      name: `Discord Face Swap - ${Date.now()}`,
      assets: {
        faceSwapMode: "all-faces",
        sourceFilePath: sourceFacePath,
        targetFilePath: targetImagePath,
      },
    });

    const projectId = createResponse.id;
    logger.debug(CONTEXT, "Face swap job created", { projectId });

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (5 seconds * 60)

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

      const statusResponse = await magicHourClient.v1.imageProjects.get({
        id: projectId,
      });

      logger.debug(CONTEXT, "Polling face swap status", {
        projectId,
        status: statusResponse.status,
        attempt: attempts + 1,
        maxAttempts,
      });

      if (statusResponse.status === "complete") {
        logger.info(CONTEXT, "Face swap completed", {
          projectId,
          creditsCharged: statusResponse.creditsCharged,
        });

        if (
          !statusResponse.downloads ||
          statusResponse.downloads.length === 0
        ) {
          throw new Error("No download URL returned from Magic Hour API");
        }

        return {
          id: statusResponse.id,
          downloadUrl: statusResponse.downloads[0].url,
          creditsCharged: statusResponse.creditsCharged,
        };
      } else if (statusResponse.status === "error") {
        const errorMsg =
          (statusResponse as any).error?.message || "Unknown error";
        throw new Error(`Face swap failed: ${errorMsg}`);
      }

      attempts++;
    }

    throw new Error("Face swap timed out after 5 minutes");
  } catch (error: any) {
    logger.error(CONTEXT, "Error during face swap", null, error);

    // Parse Magic Hour API errors
    const magicHourError: MagicHourError = {
      code: error.code || error.statusCode?.toString() || "unknown",
      message: error.message || "An unknown error occurred during face swap",
    };

    throw magicHourError;
  }
}

/**
 * Swap faces in a video or GIF
 * @param sourceFacePath - Magic Hour file path for source face image
 * @param videoPath - Magic Hour file path for target video/GIF
 * @param maxDuration - Maximum duration in seconds (default 20)
 * @returns Face swap result with download URL and credits charged
 */
export async function swapFacesInVideo(
  sourceFacePath: string,
  videoPath: string,
  maxDuration: number = 20
): Promise<FaceSwapResult> {
  const magicHourClient = getClient();

  try {
    logger.info(CONTEXT, "Starting video face swap", {
      sourceFacePath,
      videoPath,
      maxDuration,
    });

    // Use Face Swap Video API
    const createResponse = await magicHourClient.v1.faceSwap.create({
      name: `Discord GIF Face Swap - ${Date.now()}`,
      assets: {
        faceSwapMode: "all-faces",
        imageFilePath: sourceFacePath,
        videoFilePath: videoPath,
        videoSource: "file",
      },
      startSeconds: 0,
      endSeconds: maxDuration,
    });

    const projectId = createResponse.id;
    logger.debug(CONTEXT, "Video face swap job created", { projectId });

    // Poll for completion (videos take longer than photos)
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max (5 seconds * 120)

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

      const statusResponse = await magicHourClient.v1.videoProjects.get({
        id: projectId,
      });

      logger.debug(CONTEXT, "Polling video face swap status", {
        projectId,
        status: statusResponse.status,
        attempt: attempts + 1,
        maxAttempts,
      });

      if (statusResponse.status === "complete") {
        logger.info(CONTEXT, "Video face swap completed", {
          projectId,
          creditsCharged: statusResponse.creditsCharged,
        });

        if (
          !statusResponse.downloads ||
          statusResponse.downloads.length === 0
        ) {
          throw new Error("No download URL returned from Magic Hour API");
        }

        return {
          id: statusResponse.id,
          downloadUrl: statusResponse.downloads[0].url,
          creditsCharged: statusResponse.creditsCharged,
        };
      } else if (statusResponse.status === "error") {
        const errorMsg =
          (statusResponse as any).error?.message || "Unknown error";
        throw new Error(`Video face swap failed: ${errorMsg}`);
      }

      attempts++;
    }

    throw new Error("Video face swap timed out after 10 minutes");
  } catch (error: any) {
    logger.error(CONTEXT, "Error during video face swap", null, error);

    // Parse Magic Hour API errors
    const magicHourError: MagicHourError = {
      code: error.code || error.statusCode?.toString() || "unknown",
      message:
        error.message || "An unknown error occurred during video face swap",
    };

    throw magicHourError;
  }
}

/**
 * Validate image URL format
 */
export function isValidImageUrl(url: string): boolean {
  const validExtensions = [
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".avif",
    ".jp2",
    ".tiff",
    ".bmp",
  ];
  const urlLower = url.toLowerCase();
  return validExtensions.some((ext) => urlLower.includes(ext));
}

/**
 * Validate video/GIF URL format
 */
export function isValidVideoUrl(url: string): boolean {
  const validExtensions = [".gif", ".mp4", ".mov", ".webm", ".m4v"];
  const urlLower = url.toLowerCase();
  return validExtensions.some((ext) => urlLower.includes(ext));
}

/**
 * Upload a file buffer to Magic Hour storage
 * @param fileBuffer - The file data as a Buffer
 * @param extension - File extension (e.g., 'jpg', 'png')
 * @returns The file path on Magic Hour storage
 */
export async function uploadToMagicHour(
  fileBuffer: Buffer,
  extension: string
): Promise<string> {
  const magicHourClient = getClient();

  try {
    logger.debug(CONTEXT, "Requesting upload URL", { extension });

    // Determine file type based on extension
    const isVideo = ["gif", "mp4", "mov", "webm", "m4v"].includes(
      extension.toLowerCase()
    );
    const fileType = isVideo ? "video" : "image";

    // Request upload URL from Magic Hour
    const uploadUrlResponse = await magicHourClient.v1.files.uploadUrls.create({
      items: [
        {
          type: fileType,
          extension: extension,
        },
      ],
    });

    const uploadInfo = uploadUrlResponse.items[0];
    logger.debug(CONTEXT, "Uploading file to Magic Hour", {
      bytes: fileBuffer.length,
      fileType,
    });

    // Upload file to the presigned URL
    const uploadResponse = await fetch(uploadInfo.uploadUrl, {
      method: "PUT",
      body: fileBuffer,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.statusText}`);
    }

    logger.info(CONTEXT, "Uploaded file to Magic Hour", {
      filePath: uploadInfo.filePath,
    });

    return uploadInfo.filePath;
  } catch (error: any) {
    logger.error(
      CONTEXT,
      "Error uploading to Magic Hour",
      { extension },
      error
    );
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

/**
 * Get user-friendly error message based on error code
 */
export function getFriendlyErrorMessage(error: MagicHourError): string {
  const errorCode = error.code?.toLowerCase();

  switch (errorCode) {
    case "no_source_face":
      return "❌ No face detected in the source image. Please use a different image with a clear face.";
    case "no_target_face":
      return "❌ No face detected in the target image. Please use a different image with a clear face.";
    case "invalid_file":
      return "❌ Invalid image file. Please upload a valid PNG, JPG, JPEG, or WEBP image.";
    case "rate_limit":
      return "❌ API rate limit exceeded. Please try again in a few moments.";
    case "insufficient_credits":
      return "❌ Insufficient credits in Magic Hour account. Please check your account balance.";
    case "401":
      return "❌ Magic Hour API authentication failed. Please check the API key configuration.";
    case "422":
      return "❌ Invalid request to Magic Hour API. Please check the image formats.";
    default:
      return `❌ Face swap failed: ${error.message}`;
  }
}
