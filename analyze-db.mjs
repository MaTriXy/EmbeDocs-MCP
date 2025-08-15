import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://romiluz:05101994@mongodocs.gdssyqd.mongodb.net/?retryWrites=true&w=majority&appName=mongodocs';

async function deepAnalysis() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    // List all databases
    const dbs = await client.db().admin().listDatabases();
    console.log('\n📊 DATABASES:');
    dbs.databases.forEach(db => {
      console.log(`  - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });
    
    // Focus on our database
    const db = client.db('mongodb_semantic_docs');
    const collections = await db.listCollections().toArray();
    
    console.log('\n📁 COLLECTIONS in mongodb_semantic_docs:');
    for (const col of collections) {
      const collection = db.collection(col.name);
      const count = await collection.countDocuments();
      console.log(`  - ${col.name}: ${count} documents`);
    }
    
    // Deep dive into documents collection
    const docsCollection = db.collection('documents');
    
    // Sample document structure
    console.log('\n🔬 SAMPLE DOCUMENT STRUCTURE:');
    const sample = await docsCollection.findOne();
    console.log('Fields:', Object.keys(sample || {}));
    
    // Check embedding dimensions
    if (sample && sample.embedding) {
      console.log('Embedding dimensions:', sample.embedding.length);
      console.log('Embedding model:', sample.embeddingModel);
    }
    
    // Product distribution
    console.log('\n�� PRODUCT DISTRIBUTION:');
    const products = await docsCollection.aggregate([
      { $group: { _id: '$product', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    products.forEach(p => {
      console.log(`  ${p._id}: ${p.count} documents`);
    });
    
    // Check metadata structure
    console.log('\n📋 METADATA STRUCTURE:');
    const docWithMetadata = await docsCollection.findOne({ metadata: { $exists: true } });
    if (docWithMetadata && docWithMetadata.metadata) {
      console.log('Metadata fields:', Object.keys(docWithMetadata.metadata));
      console.log('Sample title:', docWithMetadata.metadata.title?.substring(0, 50));
    }
    
    // Check indexes
    console.log('\n🔍 INDEXES:');
    const indexes = await docsCollection.indexes();
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}:`, idx.key);
    });
    
    // Check vector search indexes
    console.log('\n🚀 VECTOR SEARCH INDEXES:');
    const searchIndexes = await docsCollection.listSearchIndexes().toArray();
    searchIndexes.forEach(idx => {
      console.log(`  - ${idx.name} (${idx.type}):`, idx.status);
      if (idx.definition) {
        console.log('    Fields:', idx.definition.fields?.map(f => `${f.path} (${f.type})`));
      }
    });
    
    // Sample content
    console.log('\n📝 SAMPLE CONTENT (5 random docs):');
    const samples = await docsCollection.aggregate([
      { $sample: { size: 5 } },
      { $project: { 
        product: 1,
        title: '$metadata.title',
        contentSnippet: { $substr: ['$content', 0, 100] }
      }}
    ]).toArray();
    
    samples.forEach((doc, i) => {
      console.log(`\n  ${i+1}. Product: ${doc.product}`);
      console.log(`     Title: ${doc.title || 'N/A'}`);
      console.log(`     Content: ${doc.contentSnippet}...`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

deepAnalysis();
