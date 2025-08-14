/**
 * Type definitions for MongoDB Semantic MCP
 */

export interface Document {
  id: string;
  content: string;
  metadata: DocumentMetadata;
}

export interface DocumentMetadata {
  path: string;
  product: MongoDBProduct;
  version?: string;
  title: string;
  url: string;
  lastModified?: string;
  language?: string;
  section?: string;
}

export type MongoDBProduct = 'manual' | 'atlas' | 'drivers' | 'compass' | 'tools' | 'guides' | 'voyage';

export interface Chunk {
  content: string;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  sectionTitle?: string;
  sectionLevel?: number;
  hasCode: boolean;
  tokenCount: number;
  isContinuation?: boolean;
  chunkIndex?: number;
  isExample?: boolean;
  contentType?: 'technical' | 'conceptual' | 'meta' | 'general';
  sectionTitles?: string[];
  qualityScore?: number;
  boostFactor?: number;
  [key: string]: any;
}

export interface ChunkedDocument {
  documentId: string;
  documentMetadata: DocumentMetadata;
  chunks: Chunk[];
  totalChunks: number;
}

export interface VectorDocument {
  _id?: string;
  content: string;
  contentHash: string;
  embedding: number[];
  embeddingModel: 'voyage-3';
  embeddedAt: Date;
  metadata: {
    documentId: string;
    chunkIndex: number;
    totalChunks: number;
    product: MongoDBProduct;
    version?: string;
    title: string;
    section?: string;
    url: string;
    language?: string;
    hasCode: boolean;
    tokenCount: number;
  };
  searchMeta?: {
    clickCount: number;
    boostFactor: number;
  };
}

export interface SearchOptions {
  filter?: any;
  limit?: number;
  includeCode?: boolean;
  products?: MongoDBProduct[];
  version?: string;
}

export interface SearchResult {
  documentId: string;
  chunks: Array<{
    content: string;
    score: number;
    chunkIndex: number;
  }>;
  maxScore: number;
  metadata: DocumentMetadata;
}

export interface RefreshResult {
  documentsChecked: number;
  documentsUpdated: number;
  newDocuments: number;
  deletedDocuments: number;
  errors: Array<{ document: string; error: any }>;
}

export interface EmbeddingBatch {
  documents: ChunkedDocument[];
  totalTokens: number;
  totalChunks: number;
}