export interface SearchDocument {
  id: string;
  schoolId: string;
  entityType: string;
  entityId: string;
  searchVector?: string;
  createdAt: string;
  updatedAt: string;
}
