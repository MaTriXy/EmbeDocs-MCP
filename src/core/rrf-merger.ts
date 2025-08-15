/**
 * Reciprocal Rank Fusion (RRF) implementation for hybrid search
 * Based on research from production RAG systems
 */

export interface RRFConfig {
  k?: number; // RRF constant (default: 60)
  vectorWeight?: number; // Weight for vector search (default: 0.7)
  keywordWeight?: number; // Weight for keyword search (default: 0.3)
  bothBoost?: number; // Boost for docs appearing in both (default: 1.2)
  toolsPenalty?: number; // Penalty for 'tools' product (default: 0.3)
  docBoost?: number; // Boost for documentation products (default: 1.3)
}

export class RRFMerger {
  private config: Required<RRFConfig>;
  
  constructor(config: RRFConfig = {}) {
    this.config = {
      k: config.k ?? 60,
      vectorWeight: config.vectorWeight ?? 0.7,
      keywordWeight: config.keywordWeight ?? 0.3,
      bothBoost: config.bothBoost ?? 1.2,
      toolsPenalty: config.toolsPenalty ?? 0.3,
      docBoost: config.docBoost ?? 1.3
    };
  }
  
  /**
   * Merge results using Reciprocal Rank Fusion
   */
  mergeResults(
    vectorResults: any[],
    keywordResults: any[]
  ): any[] {
    const merged = new Map<string, any>();
    const vectorRanks = new Map<string, number>();
    const keywordRanks = new Map<string, number>();
    
    // Assign ranks to vector results
    vectorResults.forEach((result, index) => {
      const id = result.document._id?.toString() || '';
      vectorRanks.set(id, index + 1);
      if (!merged.has(id)) {
        merged.set(id, result);
      }
    });
    
    // Assign ranks to keyword results
    keywordResults.forEach((result, index) => {
      const id = result.document._id?.toString() || '';
      keywordRanks.set(id, index + 1);
      if (!merged.has(id)) {
        merged.set(id, result);
      }
    });
    
    // Calculate RRF scores
    merged.forEach((doc, id) => {
      const vectorRank = vectorRanks.get(id) || 1000;
      const keywordRank = keywordRanks.get(id) || 1000;
      
      // RRF formula: 1 / (k + rank)
      const vectorRRF = 1 / (this.config.k + vectorRank);
      const keywordRRF = 1 / (this.config.k + keywordRank);
      
      // Combined RRF score
      doc.hybridScore = (vectorRRF * this.config.vectorWeight) + 
                       (keywordRRF * this.config.keywordWeight);
      
      // Boost for appearing in both
      if (vectorRank < 1000 && keywordRank < 1000) {
        doc.hybridScore *= this.config.bothBoost;
      }
      
      // Product-based adjustments
      const product = doc.document.product || 'unknown';
      
      // Penalize 'tools' (code comments)
      if (product === 'tools') {
        doc.hybridScore *= this.config.toolsPenalty;
      }
      
      // Boost actual documentation
      const docProducts = ['manual', 'nodejs', 'pymongo', 'atlas-chatbot', 'specs', 'terraform', 'langchain'];
      if (docProducts.includes(product)) {
        doc.hybridScore *= this.config.docBoost;
      }
    });
    
    // Sort by hybrid score
    return Array.from(merged.values())
      .sort((a, b) => b.hybridScore - a.hybridScore);
  }
}
