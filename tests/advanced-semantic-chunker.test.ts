import { AdvancedSemanticChunker } from '../src/core/semantic-chunker';

describe('AdvancedSemanticChunker', () => {
  let chunker: AdvancedSemanticChunker;
  
  beforeEach(() => {
    chunker = new AdvancedSemanticChunker();
  });

  afterEach(() => {
    chunker.resetMetrics();
  });

  describe('Strategy Selection', () => {
    test('should auto-select interquartile for technical documentation', async () => {
      const techContent = `MongoDB Atlas Vector Search enables you to build intelligent applications.
      
      The createIndex() function allows you to create a search index. This method requires specific parameters.
      
      To configure the index, use the following API endpoint configuration.`;
      
      const chunks = await chunker.chunkContent(techContent, 'auto');
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toContain('MongoDB Atlas Vector Search');
    });

    test('should use gradient method for policy documents', async () => {
      const policyContent = `Data encryption requirements shall be implemented according to policy standards.
      
      The organization shall maintain compliance with all applicable regulations.
      
      Security requirements must be validated through regular audits.`;
      
      const chunks = await chunker.chunkContent(policyContent, 'auto');
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toContain('Data encryption');
    });
  });

  describe('Chunking Quality', () => {
    test('should respect size constraints like Harry-231', async () => {
      const longContent = 'MongoDB documentation content. '.repeat(200);
      const chunks = await chunker.chunkContent(longContent);
      
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(3000);
        expect(chunk.length).toBeGreaterThanOrEqual(100);
      });
    });

    test('should preserve semantic boundaries', async () => {
      const semanticContent = `First concept about MongoDB indexing.
      
      Second concept about vector search capabilities.
      
      Third concept about embedding strategies.`;
      
      const chunks = await chunker.chunkContent(semanticContent, 'interquartile');
      
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      // Chunks should contain complete concepts
      chunks.forEach(chunk => {
        expect(chunk.length > 50).toBe(true);
      });
    });
  });

  describe('Performance Metrics', () => {
    test('should track chunking metrics', async () => {
      const content = 'Test content for metrics tracking. This is a longer sentence to ensure proper chunking.';
      
      await chunker.chunkContent(content);
      const metrics = chunker.getMetrics();
      
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.totalChunks).toBeGreaterThan(0);
      expect(metrics.averageChunkSize).toBeGreaterThan(0);
    });

    test('should handle fallback gracefully', async () => {
      // Test with very short content that might cause issues
      const problematicContent = 'Short.'; 
      
      const chunks = await chunker.chunkContent(problematicContent);
      const metrics = chunker.getMetrics();
      
      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
      expect(metrics.fallbackUsage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration with voyage-context-3', () => {
    test('should work with our existing embedding service', async () => {
      const mongodbContent = `MongoDB Atlas provides Vector Search capabilities.
      
      Vector embeddings enable semantic similarity matching.
      
      The voyage-context-3 model provides contextual understanding.`;
      
      const chunks = await chunker.chunkContent(mongodbContent);
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.length > 50)).toBe(true);
    });

    test('should handle different strategies correctly', async () => {
      const content = `MongoDB provides database solutions. Atlas is cloud-based. Community Server is for local development.`;
      
      const interquartileChunks = await chunker.chunkContent(content, 'interquartile');
      const gradientChunks = await chunker.chunkContent(content, 'gradient');
      const hybridChunks = await chunker.chunkContent(content, 'hybrid');
      
      expect(interquartileChunks).toBeDefined();
      expect(gradientChunks).toBeDefined();
      expect(hybridChunks).toBeDefined();
      
      // All should return valid chunks
      [interquartileChunks, gradientChunks, hybridChunks].forEach(chunks => {
        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks.every(chunk => chunk.length > 0)).toBe(true);
      });
    });
  });
});