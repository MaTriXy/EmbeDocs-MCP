const { MongoClient } = require('mongodb');
require('dotenv').config();

async function cleanDatabase() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'mongodb_semantic_docs';
  
  console.log('Connecting to MongoDB...');
  console.log('Database:', dbName);
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('documents');
    
    // Count documents before deletion
    const countBefore = await collection.countDocuments();
    console.log(`Found ${countBefore} documents in the database`);
    
    // Delete all documents
    const result = await collection.deleteMany({});
    console.log(`Deleted ${result.deletedCount} documents`);
    
    // Verify deletion
    const countAfter = await collection.countDocuments();
    console.log(`Documents remaining: ${countAfter}`);
    
    // Also drop the search indexes to recreate them with 2048 dimensions
    try {
      const indexes = await collection.listSearchIndexes().toArray();
      for (const index of indexes) {
        console.log(`Dropping index: ${index.name}`);
        await collection.dropSearchIndex(index.name);
      }
      console.log('Dropped all search indexes');
    } catch (e) {
      console.log('No search indexes to drop or error dropping:', e.message);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('Database cleaned successfully!');
  }
}

cleanDatabase();
