export interface FaceSwapResult {
  id: string;
  downloadUrl: string;
  creditsCharged: number;
}

export interface MagicHourError {
  code?: string;
  message: string;
}

// Tenor API Types
export interface TenorGif {
  id: string;
  title: string;
  media_formats: {
    gif: {
      url: string;
      size: number;
      dims: number[];
    };
    tinygif: {
      url: string;
      size: number;
      dims: number[];
    };
  };
  url: string;
  itemurl: string;
}

export interface SearchState {
  searchId: string;
  query: string;
  results: TenorGif[];
  currentPage: number;
  totalPages: number;
  userId: string;
  channelId: string;
  selectedGif?: TenorGif;
  timestamp: number;
}

export interface StateUpdateResult {
  success: boolean;
  error?: string;
}
