/**
 * MongoDB Migration Script
 * Location: newCRMBackend-main/migrations/001-add-features.js
 * 
 * Run with: node migrations/001-add-features.js
 * Or: npm run migrate
 */

const mongoose = require('mongoose');
require('dotenv').config();

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm';

async function runMigration() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // ============================================
    // STEP 1: Add profilePicture field to User collection
    // ============================================
    console.log('\n📝 Step 1: Adding profilePicture field to User collection...');
    const userResult = await db.collection('users').updateMany(
      { profilePicture: { $exists: false } },
      { $set: { profilePicture: null } }
    );
    console.log(`✓ Updated ${userResult.modifiedCount} user documents`);

    // ============================================
    // STEP 2: Add profilePicture field to Admin collection
    // ============================================
    console.log('📝 Step 2: Adding profilePicture field to Admin collection...');
    const adminResult = await db.collection('admins').updateMany(
      { profilePicture: { $exists: false } },
      { $set: { profilePicture: null } }
    );
    console.log(`✓ Updated ${adminResult.modifiedCount} admin documents`);

    // ============================================
    // STEP 3: Add profilePicture field to Client collection
    // ============================================
    console.log('📝 Step 3: Adding profilePicture field to Client collection...');
    const clientResult = await db.collection('clients').updateMany(
      { profilePicture: { $exists: false } },
      { $set: { profilePicture: null } }
    );
    console.log(`✓ Updated ${clientResult.modifiedCount} client documents`);

    // ============================================
    // STEP 4: Update DirectMessage collection with new fields
    // ============================================
    console.log('📝 Step 4: Updating DirectMessage collection with new fields...');
    const dmResult = await db.collection('directmessages').updateMany(
      {},
      {
        $set: {
          isDeleted: false,
          deletedAt: null,
          editHistory: [],
          editedAt: null,
          fileUrl: null,
          fileType: null,
          mentions: []
        }
      }
    );
    console.log(`✓ Updated ${dmResult.modifiedCount} direct messages`);

    // ============================================
    // STEP 5: Update ChannelMessage collection with new fields
    // ============================================
    console.log('📝 Step 5: Updating ChannelMessage collection with new fields...');
    const cmResult = await db.collection('channelmessages').updateMany(
      {},
      {
        $set: {
          isDeleted: false,
          deletedAt: null,
          editHistory: [],
          editedAt: null,
          fileUrl: null,
          fileType: null,
          mentions: []
        }
      }
    );
    console.log(`✓ Updated ${cmResult.modifiedCount} channel messages`);

    // ============================================
    // STEP 6: Update Channels collection with new fields
    // ============================================
    console.log('📝 Step 6: Updating Channels collection with new fields...');
    const channelResult = await db.collection('channels').updateMany(
      {},
      {
        $set: {
          channelImage: null,
          tags: [],
          customTags: [],
          details: {
            purpose: "",
            guidelines: "",
            additionalInfo: ""
          }
        }
      }
    );
    console.log(`✓ Updated ${channelResult.modifiedCount} channels`);

    // ============================================
    // STEP 7: Create Payslip collection with indexes
    // ============================================
    console.log('📝 Step 7: Creating Payslip collection with indexes...');
    try {
      await db.collection('payslips').drop();
      console.log('  - Dropped existing payslips collection');
    } catch (e) {
      // Collection doesn't exist yet
    }
    
    await db.createCollection('payslips');
    await db.collection('payslips').createIndex(
      { employeeId: 1, month: 1, year: 1 },
      { unique: true }
    );
    await db.collection('payslips').createIndex({ employeeId: 1 });
    await db.collection('payslips').createIndex({ uploadedAt: -1 });
    console.log('✓ Payslip collection created with indexes');

    // ============================================
    // STEP 8: Create ChannelReport collection with indexes
    // ============================================
    console.log('📝 Step 8: Creating ChannelReport collection with indexes...');
    try {
      await db.collection('channelreports').drop();
      console.log('  - Dropped existing channelreports collection');
    } catch (e) {
      // Collection doesn't exist yet
    }
    
    await db.createCollection('channelreports');
    await db.collection('channelreports').createIndex(
      { channelId: 1, month: 1, year: 1 },
      { unique: true }
    );
    await db.collection('channelreports').createIndex({ channelId: 1 });
    await db.collection('channelreports').createIndex({ uploadedAt: -1 });
    console.log('✓ ChannelReport collection created with indexes');

    // ============================================
    // STEP 9: Create BulkInvite collection
    // ============================================
    console.log('📝 Step 9: Creating BulkInvite collection...');
    try {
      await db.collection('bulkinvites').drop();
      console.log('  - Dropped existing bulkinvites collection');
    } catch (e) {
      // Collection doesn't exist yet
    }
    
    await db.createCollection('bulkinvites');
    await db.collection('bulkinvites').createIndex({ email: 1 });
    await db.collection('bulkinvites').createIndex({ channelId: 1 });
    await db.collection('bulkinvites').createIndex({ createdAt: -1 });
    console.log('✓ BulkInvite collection created with indexes');

    // ============================================
    // STEP 10: Create additional indexes
    // ============================================
    console.log('📝 Step 10: Creating additional indexes for performance...');
    
    try {
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      console.log('  ✓ User email index');
    } catch (e) {
      console.log('  ℹ User email index already exists');
    }

    try {
      await db.collection('admins').createIndex({ email: 1 }, { unique: true });
      console.log('  ✓ Admin email index');
    } catch (e) {
      console.log('  ℹ Admin email index already exists');
    }

    try {
      await db.collection('clients').createIndex({ email: 1 }, { unique: true });
      console.log('  ✓ Client email index');
    } catch (e) {
      console.log('  ℹ Client email index already exists');
    }

    try {
      await db.collection('directmessages').createIndex({ conversationId: 1 });
      await db.collection('directmessages').createIndex({ senderId: 1 });
      await db.collection('directmessages').createIndex({ createdAt: -1 });
      console.log('  ✓ DirectMessage indexes');
    } catch (e) {
      console.log('  ℹ DirectMessage indexes already exist');
    }

    try {
      await db.collection('channelmessages').createIndex({ channelId: 1 });
      await db.collection('channelmessages').createIndex({ senderId: 1 });
      await db.collection('channelmessages').createIndex({ createdAt: -1 });
      console.log('  ✓ ChannelMessage indexes');
    } catch (e) {
      console.log('  ℹ ChannelMessage indexes already exist');
    }

    // ============================================
    // VERIFICATION
    // ============================================
    console.log('\n' + '='.repeat(50));
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(50));
    
    const collections = await db.listCollections().toArray();
    console.log('\n📊 Collections Status:');
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`  - ${col.name}: ${count} documents`);
    }

    console.log('\n✨ Migration finished without errors!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED!');
    console.error('Error:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run migration
runMigration();
