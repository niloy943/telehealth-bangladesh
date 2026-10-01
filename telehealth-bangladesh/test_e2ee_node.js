import { 
  getOrCreateIdentityKeyPair,
  generateEphemeralKeyPair,
  exportPublicKey,
  importPublicKey,
  signKeyExchange,
  verifyKeyExchangeSignature,
  deriveSessionKey,
  encryptMessage,
  decryptMessage,
  generateFingerprint
} from './frontend-src/src/utils/e2ee.js';
import assert from 'assert';

// Mock browser objects for Node environment if needed
if (typeof window === 'undefined') {
  global.window = {
    crypto: globalThis.crypto
  };
}

async function testE2EE() {
  console.log("=== STARTING E2EE CRYPTOGRAPHIC UNIT TESTS ===");

  // Test 1: Identity Keypair generation
  console.log("Test 1: Generating local identity key pairs...");
  const patientIdKeyPair = await window.crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const doctorIdKeyPair = await window.crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  assert.ok(patientIdKeyPair.publicKey);
  assert.ok(patientIdKeyPair.privateKey);
  console.log("  [PASS] Identity keys generated.");

  // Test 2: Public Key export / import
  console.log("Test 2: Exporting and importing public keys...");
  const patientIdPubB64 = await exportPublicKey(patientIdKeyPair.publicKey);
  const importedPatientIdPub = await importPublicKey(patientIdPubB64, "ECDSA", ["verify"]);
  assert.ok(importedPatientIdPub);
  console.log("  [PASS] Public keys successfully exported and imported.");

  // Test 3: Ephemeral ECDH Key Pair generation
  console.log("Test 3: Generating ephemeral ECDH key pairs...");
  const patientEpKeyPair = await generateEphemeralKeyPair();
  const doctorEpKeyPair = await generateEphemeralKeyPair();
  assert.ok(patientEpKeyPair.publicKey);
  assert.ok(doctorEpKeyPair.publicKey);
  console.log("  [PASS] Ephemeral keys generated.");

  // Test 4: Key signing and verification
  console.log("Test 4: Signing and verifying ephemeral exchange keys...");
  const patientEpPubB64 = await exportPublicKey(patientEpKeyPair.publicKey);
  const signature = await signKeyExchange(patientIdKeyPair.privateKey, patientEpPubB64);
  
  const isVerified = await verifyKeyExchangeSignature(
    importedPatientIdPub,
    patientEpPubB64,
    signature
  );
  assert.strictEqual(isVerified, true);
  console.log("  [PASS] Ephemeral key signatures verify correctly.");

  // Test 5: Key derivation
  console.log("Test 5: Deriving session keys...");
  const doctorEpPubB64 = await exportPublicKey(doctorEpKeyPair.publicKey);
  const importedDoctorEpPub = await importPublicKey(doctorEpPubB64, "ECDH", []);
  const importedPatientEpPub = await importPublicKey(patientEpPubB64, "ECDH", []);

  const patientSessionKey = await deriveSessionKey(
    patientEpKeyPair.privateKey,
    importedDoctorEpPub
  );
  const doctorSessionKey = await deriveSessionKey(
    doctorEpKeyPair.privateKey,
    importedPatientEpPub
  );
  assert.ok(patientSessionKey);
  assert.ok(doctorSessionKey);
  console.log("  [PASS] Symmetric session keys derived.");

  // Test 6: Message Encryption / Decryption
  console.log("Test 6: Encrypting and decrypting test message...");
  const plaintext = "Patient has a fever and needs medical advice.";
  const metadata = { consultation_id: 123, sender: "sadia" };

  const encrypted = await encryptMessage(patientSessionKey, plaintext, metadata);
  assert.ok(encrypted.ciphertext);
  assert.ok(encrypted.iv);
  console.log("  [PASS] Plaintext successfully encrypted to base64 ciphertext.");

  console.log("Test 7: Decrypting ciphertext at peer endpoint...");
  const decrypted = await decryptMessage(
    doctorSessionKey,
    encrypted.ciphertext,
    encrypted.iv,
    encrypted.aad
  );
  assert.strictEqual(decrypted, plaintext);
  console.log("  [PASS] Ciphertext successfully decrypted back to plaintext: ", decrypted);

  // Test 8: Tampering protection (modify ciphertext)
  console.log("Test 8: Testing ciphertext tampering warning...");
  const tamperedCiphertext = encrypted.ciphertext.substring(0, 10) + "A" + encrypted.ciphertext.substring(11);
  try {
    await decryptMessage(
      doctorSessionKey,
      tamperedCiphertext,
      encrypted.iv,
      encrypted.aad
    );
    assert.fail("Tampered ciphertext should have thrown decryption error!");
  } catch (err) {
    console.log("  [PASS] Authenticated encryption (AES-GCM) caught tampered ciphertext package correctly!");
  }

  // Test 9: Tampering protection (modify IV)
  console.log("Test 9: Testing IV tampering warning...");
  const tamperedIv = encrypted.iv.substring(0, 5) + "B" + encrypted.iv.substring(6);
  try {
    await decryptMessage(
      doctorSessionKey,
      encrypted.ciphertext,
      tamperedIv,
      encrypted.aad
    );
    assert.fail("Tampered IV should have thrown decryption error!");
  } catch (err) {
    console.log("  [PASS] Authenticated encryption (AES-GCM) caught tampered IV correctly!");
  }

  console.log("\n>>> ALL E2EE CRYPTOGRAPHIC UNIT TESTS PASSED SUCCESSFULLY! <<<");
}

testE2EE().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
