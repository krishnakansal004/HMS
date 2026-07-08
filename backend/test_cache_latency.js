import 'dotenv/config';
import User from './src/models/User.js';

async function testCache() {
    console.log('Fetching first user to get a valid ID...');
    const users = await User.find({}).limit(1);
    if (!users.length) {
        console.error('No users found in database to test caching!');
        process.exit(1);
    }
    const userId = users[0]._id;
    console.log(`Found User ID: ${userId}. Starting cache latency test...`);
    
    // First lookup (cache miss)
    console.log('\n--- Query 1 (Expected: Cache Miss) ---');
    const start1 = Date.now();
    const user1 = await User.findById(userId);
    const duration1 = Date.now() - start1;
    console.log(`Query 1 completed in ${duration1}ms. User loaded: ${user1?.name}`);
    
    // Second lookup (cache hit)
    console.log('\n--- Query 2 (Expected: Cache Hit) ---');
    const start2 = Date.now();
    const user2 = await User.findById(userId);
    const duration2 = Date.now() - start2;
    console.log(`Query 2 completed in ${duration2}ms. User loaded: ${user2?.name}`);
    
    if (duration2 < 10) {
        console.log('\n[SUCCESS] Second query hit the local memory cache (completed in < 10ms)!');
    } else {
        console.error('\n[FAILURE] Second query did not hit the cache or took too long!');
    }
    process.exit(0);
}

testCache().catch(console.error);
