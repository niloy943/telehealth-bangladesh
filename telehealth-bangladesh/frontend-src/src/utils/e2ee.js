// Client-side End-to-End Encryption (E2EE) helper utility using Web Crypto APIs
// Supports ECDH key exchange, ECDSA signature identity check, and AES-GCM-256 chat payload encryption.

const DB_NAME = "HealNSightE2EEKeys";
const STORE_NAME = "IdentityKeys";

// Open IndexDB database for persistent key storage
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

// Persist key to IndexedDB
async function saveKey(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Retrieve key from IndexedDB
async function getKey(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generate or retrieve the client's persistent ECDSA P-256 identity signing keypair.
 */
export async function getOrCreateIdentityKeyPair() {
  try {
    const existing = await getKey("identity_keypair");
    if (existing) {
      return existing; // Returns { publicKey: CryptoKey, privateKey: CryptoKey }
    }

    const keypair = await window.crypto.subtle.generateKey(
      {
        name: "ECDSA",
        namedCurve: "P-256"
      },
      false, // private key is non-extractable from browser
      ["sign", "verify"]
    );

    await saveKey("identity_keypair", keypair);
    return keypair;
  } catch (err) {
    console.error("Failed to generate identity keypair:", err);
    throw err;
  }
}

/**
 * Generate ephemeral ECDH keypair for the active consultation session.
 */
export async function generateEphemeralKeyPair() {
  return await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    true, // Extractable so we can export public key
    ["deriveKey", "deriveBits"]
  );
}

/**
 * Export a public key (ECDSA or ECDH) to raw/SubjectPublicKeyInfo format.
 */
export async function exportPublicKey(key) {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

/**
 * Import raw base64 key into a CryptoKey object.
 */
export async function importPublicKey(spkiB64, algName, usages) {
  const raw = Uint8Array.from(atob(spkiB64), c => c.charCodeAt(0));
  return await window.crypto.subtle.importKey(
    "spki",
    raw,
    {
      name: algName,
      namedCurve: "P-256"
    },
    true,
    usages
  );
}

/**
 * Sign ephemeral public key using user's private ECDSA signing identity key.
 */
export async function signKeyExchange(privateSignKey, ephemeralPublicKeyB64) {
  const encoder = new TextEncoder();
  const data = encoder.encode(ephemeralPublicKeyB64);
  const signature = await window.crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: { name: "SHA-256" }
    },
    privateSignKey,
    data
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Verify identity signature of ephemeral key from the peer.
 */
export async function verifyKeyExchangeSignature(publicSignKey, ephemeralPublicKeyB64, signatureB64) {
  const encoder = new TextEncoder();
  const data = encoder.encode(ephemeralPublicKeyB64);
  const signature = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));
  return await window.crypto.subtle.verify(
    {
      name: "ECDSA",
      hash: { name: "SHA-256" }
    },
    publicSignKey,
    signature,
    data
  );
}

/**
 * Derive shared AES-GCM session key using client's private ECDH and peer's public ECDH.
 */
export async function deriveSessionKey(privateEcdh, publicEcdh) {
  // Derive shared bits
  const sharedBits = await window.crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: publicEcdh
    },
    privateEcdh,
    256
  );

  // Derive AES-GCM key from shared bits via HKDF-like digest iteration (or import raw)
  // For standard compatibility, import raw SHA-256 digest of shared bits as AES-GCM key
  const hashedBits = await window.crypto.subtle.digest("SHA-256", sharedBits);

  return await window.crypto.subtle.importKey(
    "raw",
    hashedBits,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt chat message using derived AES-GCM session key.
 */
export async function encryptMessage(sessionKey, plaintext, additionalMetadata = {}) {
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(plaintext);
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit fresh random IV
  
  // Pack Additional Authenticated Data (AAD)
  const aadString = JSON.stringify(additionalMetadata);
  const aadBytes = encoder.encode(aadString);

  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
      additionalData: aadBytes
    },
    sessionKey,
    textBytes
  );

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv)),
    aad: aadString
  };
}

/**
 * Decrypt chat message using AES-GCM session key.
 */
export async function decryptMessage(sessionKey, ciphertextB64, ivB64, aadString) {
  const ciphertext = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
  
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const aadBytes = encoder.encode(aadString);

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
      additionalData: aadBytes
    },
    sessionKey,
    ciphertext
  );

  return decoder.decode(decrypted);
}

/**
 * Generate fingerprint matching key material for MitM visual comparisons.
 */
export function generateFingerprint(keyMaterial1, keyMaterial2) {
  const combined = [keyMaterial1, keyMaterial2].sort().join(":");
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  return `${hex.substring(0, 4)}-${hex.substring(4, 8)}`;
}
