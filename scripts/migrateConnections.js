/**
 * migrateConnections.js
 * 
 * One-time migration script that auto-connects:
 * 1. All users who already have an existing private conversation
 * 2. All pairs of members within each team
 * 
 * Run with: node scripts/migrateConnections.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(
  readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const { Timestamp } = admin.firestore;

function getConnectionId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

async function autoConnect(uid1, uid2, batch, existingIds) {
  const connId = getConnectionId(uid1, uid2);
  if (existingIds.has(connId)) return { created: false };

  const [a, b] = [uid1, uid2].sort();
  const ref = db.collection('connections').doc(connId);
  batch.set(ref, {
    userA: a,
    userB: b,
    requestedBy: 'system',
    status: 'accepted',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }, { merge: true });

  existingIds.add(connId);
  return { created: true };
}

async function main() {
  console.log('🔗 Starting connections migration...\n');

  // Load all existing connection IDs to avoid duplicates
  const existingSnap = await db.collection('connections').get();
  const existingIds = new Set(existingSnap.docs.map((d) => d.id));
  console.log(`Found ${existingIds.size} existing connections.\n`);

  let totalCreated = 0;
  let batches = [];
  let currentBatch = db.batch();
  let currentBatchCount = 0;

  function flushBatch() {
    if (currentBatchCount > 0) {
      batches.push(currentBatch);
      currentBatch = db.batch();
      currentBatchCount = 0;
    }
  }

  async function addPair(uid1, uid2) {
    if (uid1 === uid2) return;
    const connId = getConnectionId(uid1, uid2);
    if (existingIds.has(connId)) return;

    const [a, b] = [uid1, uid2].sort();
    const ref = db.collection('connections').doc(connId);
    currentBatch.set(ref, {
      userA: a,
      userB: b,
      requestedBy: 'system',
      status: 'accepted',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }, { merge: true });

    existingIds.add(connId);
    totalCreated++;
    currentBatchCount++;

    if (currentBatchCount >= 400) {
      flushBatch();
    }
  }

  // 1. Private conversations
  console.log('📬 Processing private conversations...');
  const convsSnap = await db.collection('conversations').get();
  let convCount = 0;

  for (const convDoc of convsSnap.docs) {
    const data = convDoc.data();
    const participants = data.participants || [];
    // Only private (2-person) conversations without teamId
    if (participants.length === 2 && !data.teamId) {
      await addPair(participants[0], participants[1]);
      convCount++;
    }
  }
  console.log(`  → Processed ${convCount} private conversations\n`);

  // 2. Team member pairs
  console.log('👥 Processing teams...');
  const teamsSnap = await db.collection('teams').get();
  let teamCount = 0;
  let pairCount = 0;

  for (const teamDoc of teamsSnap.docs) {
    const data = teamDoc.data();
    const memberIds = data.memberIds || [];

    for (let i = 0; i < memberIds.length; i++) {
      for (let j = i + 1; j < memberIds.length; j++) {
        await addPair(memberIds[i], memberIds[j]);
        pairCount++;
      }
    }
    teamCount++;
  }
  console.log(`  → Processed ${teamCount} teams, ${pairCount} member pairs\n`);

  // Flush remaining batch
  flushBatch();

  // Commit all batches
  if (batches.length > 0) {
    console.log(`💾 Committing ${batches.length} batch(es) (${totalCreated} new connections)...`);
    for (let i = 0; i < batches.length; i++) {
      await batches[i].commit();
      process.stdout.write(`  Batch ${i + 1}/${batches.length} done\r`);
    }
    console.log('');
  }

  console.log(`\n✅ Migration complete! Created ${totalCreated} new connections.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
