/**
 * Content Quality Scorer for MongoDB Documentation
 * Prioritizes technical content over meta-documentation
 */

import { Document } from '../types/index.js';

export interface QualityScore {
  score: number;           // 0.0 - 1.0
  reasons: string[];       // Why this score was assigned
  contentType: 'technical' | 'conceptual' | 'meta' | 'example';
  boostFactor: number;     // Multiplier for search results
}

export class ContentQualityScorer {
  
  /**
   * Score document quality based on content and metadata
   */
  scoreDocument(doc: Document): QualityScore {
    const path = doc.metadata.path || '';
    const content = doc.content;
    const title = doc.metadata.title || '';
    
    let score = 0.5; // Base score
    const reasons: string[] = [];
    let contentType: QualityScore['contentType'] = 'conceptual';
    let boostFactor = 1.0;
    
    // HIGH PRIORITY: Technical documentation with examples
    if (this.isTechnicalContent(path, content, title)) {
      score += 0.4;
      contentType = 'technical';
      boostFactor = 1.5;
      reasons.push('Technical documentation');
      
      // Extra boost for method/operator documentation
      if (this.hasMethodDocumentation(content)) {
        score += 0.2;
        boostFactor = 1.8;
        reasons.push('Contains method documentation');
      }
      
      // Extra boost for code examples
      if (this.hasCodeExamples(content)) {
        score += 0.2;
        boostFactor = 1.6;
        reasons.push('Contains code examples');
      }
      
      // Extra boost for query examples
      if (this.hasQueryExamples(content)) {
        score += 0.3;
        boostFactor = 2.0;
        reasons.push('Contains query examples');
      }
    }
    
    // MEDIUM PRIORITY: Conceptual documentation
    else if (this.isConceptualContent(path, content, title)) {
      score += 0.2;
      contentType = 'conceptual';
      boostFactor = 1.2;
      reasons.push('Conceptual documentation');
    }
    
    // LOW PRIORITY: Meta documentation
    else if (this.isMetaContent(path, content, title)) {
      score -= 0.3;
      contentType = 'meta';
      boostFactor = 0.3;
      reasons.push('Meta documentation');
    }
    
    // PRIORITY PATHS: Boost high-value directories
    if (this.isHighPriorityPath(path)) {
      score += 0.2;
      boostFactor *= 1.3;
      reasons.push('High-priority path');
    }
    
    // PENALIZE: Low-value content
    if (this.isLowValueContent(content)) {
      score -= 0.2;
      boostFactor *= 0.7;
      reasons.push('Low-value content');
    }
    
    // Ensure score is within bounds
    score = Math.max(0.0, Math.min(1.0, score));
    
    return {
      score,
      reasons,
      contentType,
      boostFactor
    };
  }
  
  private isTechnicalContent(path: string, content: string, title: string): boolean {
    const technicalIndicators = [
      // Path indicators
      /\/(reference|tutorial|examples?|operators?|methods?|aggregation|query|crud)\//i,
      // Content indicators
      /db\.\w+\.\w+\(/,
      /\$\w+/,  // MongoDB operators
      /find\(|aggregate\(|insertOne\(|updateOne\(/,
      // Title indicators
      /method|operator|function|command/i
    ];
    
    return technicalIndicators.some(pattern => 
      pattern.test(path) || pattern.test(content) || pattern.test(title)
    );
  }
  
  private isConceptualContent(path: string, content: string, title: string): boolean {
    const conceptualIndicators = [
      /\/(concepts?|fundamentals?|introduction|overview|guide)\//i,
      /what is|how to|understanding|concepts?/i
    ];
    
    return conceptualIndicators.some(pattern => 
      pattern.test(path) || pattern.test(content) || pattern.test(title)
    );
  }
  
  private isMetaContent(path: string, content: string, title: string): boolean {
    const metaIndicators = [
      /readme|contributing|license|changelog|authors/i,
      /pull.request|issue.template|code.of.conduct/i,
      /self.review|external.review|documentation.team/i
    ];
    
    return metaIndicators.some(pattern => 
      pattern.test(path) || pattern.test(content) || pattern.test(title)
    );
  }
  
  private hasMethodDocumentation(content: string): boolean {
    return /db\.\w+\.\w+\(/.test(content) && 
           /parameters?|returns?|examples?/i.test(content);
  }
  
  private hasCodeExamples(content: string): boolean {
    return /```|.. code-block::|^\s{4,}\w+/.test(content);
  }
  
  private hasQueryExamples(content: string): boolean {
    return /find\(|aggregate\(|match|group|sort|limit/.test(content) &&
           this.hasCodeExamples(content);
  }
  
  private isHighPriorityPath(path: string): boolean {
    const highPriorityPaths = [
      /\/tutorial\//i,
      /\/reference\//i,
      /\/examples?\//i,
      /\/crud\//i,
      /\/aggregation\//i,
      /\/query\//i,
      /\/operators?\//i
    ];
    
    return highPriorityPaths.some(pattern => pattern.test(path));
  }
  
  private isLowValueContent(content: string): boolean {
    // Very short content
    if (content.length < 200) return true;
    
    // Mostly markup
    const markupRatio = (content.match(/[<>{}[\]()]/g) || []).length / content.length;
    if (markupRatio > 0.3) return true;
    
    // Mostly whitespace
    const whitespaceRatio = (content.match(/\s/g) || []).length / content.length;
    if (whitespaceRatio > 0.8) return true;
    
    return false;
  }
}
