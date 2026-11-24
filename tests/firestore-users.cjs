const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const firestore = require('firebase/firestore');
const { doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc } = firestore;

const root = path.resolve(__dirname, '..');
const projectId = 'demo-readeco-users-security';
const privateProfile = { userId: 'alice', displayName: 'Alice', email: 'alice@example.invalid' };
const publicProfile = { userId: 'alice', displayName: 'Alice' };

// 実際のデータアクセス関数にエミュレーターの接続だけを注入する。
function loadUtils(filename, db) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(root, 'utils', filename), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const run = vm.runInThisContext(`(function(exports, require) {\n${code}\n})`, { filename });
  run(exports, name => name === './firebase' ? { db } : require(name));
  return exports;
}

async function main() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Firestore Emulator 内でのみ実行できます');
  const rulesPath = process.env.READECO_TEST_RULES || path.join(root, 'firebase', 'user-profile.rules');
  const env = await initializeTestEnvironment({
    projectId,
    firestore: { host: '127.0.0.1', port: 8185, rules: fs.readFileSync(rulesPath, 'utf8') },
  });
  let cases = 0;
  try {
    const roles = {
      anonymous: env.unauthenticatedContext().firestore(),
      owner: env.authenticatedContext('alice').firestore(),
      other: env.authenticatedContext('bob').firestore(),
    };
    for (const collectionName of ['users', 'publicProfiles']) {
      const data = collectionName === 'users' ? privateProfile : publicProfile;
      for (const [role, db] of Object.entries(roles)) {
        for (const operation of ['get', 'create', 'update', 'delete', 'list']) {
          await env.withSecurityRulesDisabled(async ctx => {
            const ref = doc(ctx.firestore(), collectionName, 'alice');
            await deleteDoc(ref);
            if (operation !== 'create') await setDoc(ref, data);
          });
          const ref = doc(db, collectionName, 'alice');
          const run = {
            get: () => getDoc(ref),
            create: () => setDoc(ref, data),
            update: () => updateDoc(ref, { userId: 'alice', displayName: 'Updated' }),
            delete: () => deleteDoc(ref),
            list: () => getDocs(collection(db, collectionName)),
          }[operation];
          const allow = operation !== 'list' && (role === 'owner' ||
            (collectionName === 'publicProfiles' && operation === 'get' && role === 'other'));
          await (allow ? assertSucceeds(run()) : assertFails(run()));
          cases++;
          console.log(`PASS ${collectionName}: ${role} ${operation} => ${allow ? 'ALLOW' : 'DENY'}`);
        }
      }
    }

    for (const invalid of [
      { ...publicProfile, email: 'private@example.invalid' },
      { ...publicProfile, profileImageUrl: 'https://example.invalid/private.png' },
      { ...publicProfile, admin: true },
      { ...publicProfile, userId: 'bob' },
      { ...publicProfile, displayName: '' },
      { ...publicProfile, displayName: 123 },
      { userId: 'alice' },
    ]) {
      await assertFails(setDoc(doc(roles.owner, 'publicProfiles', 'alice'), invalid));
      cases++;
    }

    // 新規登録、未定義の任意項目、部分更新、別アカウントの検索を実コードで検証。
    await env.clearFirestore();
    const { setUserSettings } = loadUtils('firebase-users.ts', roles.owner);
    const { searchUserByUserId } = loadUtils('firebase-friends.ts', roles.other);
    await setUserSettings('alice', { displayName: 'Alice', email: 'alice@example.invalid', profileImageUrl: undefined });
    let privateDoc = (await getDoc(doc(roles.owner, 'users', 'alice'))).data();
    let publicDoc = (await getDoc(doc(roles.other, 'publicProfiles', 'alice'))).data();
    assert.deepEqual(publicDoc, publicProfile);
    assert.equal(privateDoc.email, 'alice@example.invalid');
    assert.ok(privateDoc.createdAt);
    assert.equal(Object.hasOwn(privateDoc, 'profileImageUrl'), false);
    const createdAt = privateDoc.createdAt.toMillis();
    cases++;

    await setUserSettings('alice', { displayName: 'Alice updated' });
    privateDoc = (await getDoc(doc(roles.owner, 'users', 'alice'))).data();
    publicDoc = (await getDoc(doc(roles.other, 'publicProfiles', 'alice'))).data();
    assert.equal(privateDoc.email, 'alice@example.invalid');
    assert.equal(privateDoc.createdAt.toMillis(), createdAt);
    assert.deepEqual(publicDoc, { userId: 'alice', displayName: 'Alice updated' });
    const found = await searchUserByUserId('alice');
    assert.equal(found.userId, 'alice');
    assert.equal(found.displayName, 'Alice updated');
    assert.deepEqual(Object.keys(found).sort(), ['displayName', 'userId']);
    await assertFails(getDoc(doc(roles.other, 'users', 'alice')));
    assert.equal(await searchUserByUserId('missing-user'), null);
    cases++;
    console.log(`PASS ${cases} authorization and application integration cases (emulator only)`);
  } finally {
    await env.cleanup();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
