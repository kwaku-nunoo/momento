export interface MomentoEvent {
  id: string;
  code: string;
  hostKey: string;
  name: string;
  date?: string;
  location?: string;
  description?: string;
  coverPhotoId?: string;
  isArchived: boolean;
  allowUploads: boolean;
  createdAt: string;
  updatedAt: string;
  photoCount?: number;
  contributorCount?: number;
}

export interface MomentoPhoto {
  id: string;
  eventId: string;
  uploaderSessionId: string;
  uploaderName?: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
  aspectRatio: number;
  thumbnailUrl: string;
  previewUrl: string;
  originalUrl: string;
  createdAt: string;
  mediaType: 'photo' | 'video';
}

export interface UploadItem {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  status: 'queued' | 'uploading' | 'completed' | 'failed';
  error?: string;
  httpStatus?: number;
  failedAt?: string;
  photo?: MomentoPhoto;
}

export interface PublicEventResponse {
  event: Omit<MomentoEvent, 'hostKey'>;
  photos: MomentoPhoto[];
  stats: {
    photoCount: number;
    contributorCount: number;
  };
}

export interface HostEventResponse {
  event: MomentoEvent;
  photos: MomentoPhoto[];
  stats: {
    photoCount: number;
    contributorCount: number;
    totalSizeBytes: number;
  };
}
