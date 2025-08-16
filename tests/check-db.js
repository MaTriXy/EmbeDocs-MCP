#!/usr/bin/env node

import { MongoClient } from 'mongodb';

const mongoUri = process.env.MONGODB_URI || "mongodb+srv://romiluz:05101994@mongodocs.gdssyqd.mongodb.net/?retryWrites=true&w=majority&appName=mongodocs";

const client = new MongoClient(mongoUri);

try {
  await client.connect();
  const count = await client.db('mongodb_semantic_docs').collection('documents').countDocuments();
  
  console.log('🔥 BRUTAL TRUTH DATABASE STATUS:');
  console.log('═'.repeat(50));
  console.log(`📊 Documents indexed: ${count.toLocaleString()}`);
  console.log(`🎯 Target: 10,000+`);
  console.log(`📈 Progress: ${Math.round((count / 10000) * 100)}%`);
  
  if (count > 0) {
    // Get sample products
    const products = await client.db('mongodb_semantic_docs').collection('documents').distinct('product');
    console.log(`🏷️  Products: ${products.length} (${products.slice(0, 5).join(', ')}${products.length > 5 ? '...' : ''})`);
  }
  
} catch (error) {
  console.error('❌ Database check failed:', error.message);
} finally {
  await client.close();
}
