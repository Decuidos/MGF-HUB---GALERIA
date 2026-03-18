
export interface MediaItem {
  id: string;
  title: string;
  description: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl: string;
  timestamp: string;
  sourceBot: string;
  user: string;
  views: number;
  duration?: string;
  isFavorite?: boolean;
}

export interface ProcessingState {
  isProcessing: boolean;
  progress: number;
  status: string;
}

export interface TelegramGroup {
  name: string;
  handle: string;
  memberCount: string;
  status: 'online' | 'syncing' | 'offline';
  lastSync: string;
}
