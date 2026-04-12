export interface SearchResult {
  entityType: string;
  entityId: string;
  title: string;
  preview?: string;
  metadata?: Record<string, unknown>;
  relevanceScore: number;
  createdAt?: string;
}
