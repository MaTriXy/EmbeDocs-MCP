import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://romiluz:05101994@mongodocs.gdssyqd.mongodb.net/?retryWrites=true&w=majority&appName=mongodocs';
const dbName = 'mongodb_semantic_docs';
const collectionName = 'documents';

async function analyzeDatabase() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas\n');
    
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    
    // Get total count
    const count = await collection.countDocuments();
    console.log(`📊 Total Documents: ${count}\n`);
    
    // Get product distribution
    console.log('📈 PRODUCT DISTRIBUTION:');
    const products = await collection.aggregate([
      { $group: { _id: '$product', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    products.forEach(p => {
      console.log(`  ${p._id || 'unknown'}: ${p.count} documents`);
    });
    
    // Check vector search indexes
    console.log('\n🔍 VECTOR SEARCH INDEXES:');
    const indexes = await collection.listSearchIndexes().toArray();
    indexes.forEach(idx => {
      console.log(`  - ${idx.name} (${idx.type}): ${idx.status}`);
      if (idx.definition) {
        console.log('    Fields:', JSON.stringify(idx.definition.fields, null, 2));
      }
    });
    
    // Sample documents
    console.log('\n📝 SAMPLE DOCUMENTS:');
    const samples = await collection.aggregate([
      { $sample: { size: 3 } }
    ]).toArray();
    
    samples.forEach((doc, i) => {
      console.log(`\nDocument ${i + 1}:`);
      console.log('  Product:', doc.product);
      console.log('  Title:', doc.title);
      console.log('  Content Preview:', doc.content?.substring(0, 100));
      console.log('  Embedding Dimensions:', doc.embedding?.length);
      console.log('  Model:', doc.embeddingModel);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

analyzeDatabase();