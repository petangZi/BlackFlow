/**
 * Key Vault - AES-256-GCM encryption for API keys
 */

const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export class KeyVault {
  constructor(supabase) {
    this.supabase = supabase;
    this.masterKey = null;
  }

  async init() {
    const masterKeyB64 = process.env.MASTER_ENCRYPTION_KEY;
    if (!masterKeyB64) throw new Error('MASTER_ENCRYPTION_KEY not set');
    
    const keyData = Uint8Array.from(atob(masterKeyB64), c => c.charCodeAt(0));
    this.masterKey = await crypto.subtle.importKey(
      'raw', keyData, { name: ALGORITHM }, false, ['encrypt', 'decrypt']
    );
  }

  async encrypt(plaintext) {
    if (!this.masterKey) await this.init();
    
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoded = new TextEncoder().encode(plaintext);
    
    const ciphertext = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      this.masterKey,
      encoded
    );
    
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  }

  async decrypt(ciphertextB64) {
    if (!this.masterKey) await this.init();
    
    const combined = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0));
    const iv = combined.slice(0, IV_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH);
    
    const plaintext = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      this.masterKey,
      ciphertext
    );
    
    return new TextDecoder().decode(plaintext);
  }

  async rotateKey(credentialId, newPlaintext) {
    const encrypted = await this.encrypt(newPlaintext);
    await this.supabase
      .from('pool_credentials')
      .update({ enc_secret: encrypted, key_version: 2 })
      .eq('id', credentialId);
  }
}

export default KeyVault;