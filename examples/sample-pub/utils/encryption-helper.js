/**
 * @fileoverview Description of this file.
 */

const PRIMITIVE = Aead;
const DOC_KEY_SIZE = 32;


class SwgEncryptionClient {
    constructor() {
        this.aesGcm128KeyManager_ = new AesGcmKeyManager();

        this.aead_ = null;

        this.domParser_ = new DOMParser();

        AeadConfig.register();
        HybridConfig.register();
    }

    generateEncryptedDocument(html) {
        const key = this.generateNewAesGcm128Key();
        this.createAesGcm128Aead(key);
        let parsedHtml = this.parseHtmlString(html);
        let encryptedSections = this.getAllEncryptionSections(parsedHtml);
        this.encryptSections(parsedHtml, encryptedSections);
        const googlePublicKey = this.getGooglePublicKey(PUBLIC_KEY_LOC);
        const encryptedKey = this.encryptDocumentKey(key, googlePublicKey);
        this.addEncryptedDocumentKeyToHead(encryptedKey, parsedHtml);
        return parsedHtml.documentElement.innerHTML;
    }
    
    generateNewAesGcm128Key() {
        const keyFormat = new PbAesGcmKeyFormat().setKeySize(DOC_KEY_SIZE);
        return this.aesGcm128KeyManager_.getKeyFactory().newKey(keyFormat);
    }

    createAesGcm128Aead(key) {
        this.aead_ = this.aesGcm128KeyManager_.getPrimative(PRIMITIVE, key);
    }

    parseHtmlString(html) {
        return this.domParser_.parseFromString(html, 'text/html');
    }

    getAllEncryptionSections(parsedHtml) {
        const allSectionElements = parsedHtml.getElementsByTagName("section");
        let encryptionSections = [];
        for (let i = 0; i < allSectionElements.length; i++) {
            const section = allSectionElements[i];
            if (parsedHtml.body.contains(section)) {
                const contentAttr = section.getAttribute("subscriptions-section");
                if (contentAttr == "content" && section.getAttribute("encrypted")) {
                    encryptionSections.push(section);
                }
            }
        }
    }

    encryptSections(parsedHtml, encryptedSections) {
        if (this.aead_ == null) {
            return;
        }
        for (let i = 0; i < encryptedSections.length; i++) {
            let encryptedContent = this.aead_.encrypt(encryptedSections[i].innerHTML);
            let encryptedTextNode = parsedHtml.createTextNode(encryptedContent);
            let encryptedScript = parsedHtml.createElement("script");
            encryptedScript.setAttribute("type", "application/octet-stream");
            encryptedScript.setAttribute("encrypted", "");
            encryptedScript.append(encryptedTextNode);
            encryptedSections[i].innerHtml = "";
            encryptedSections[i].append(encryptedScript);
        }
    }

    async getGooglePublicKey(keyLocation) {
        await fetch(keyLocation).then(response => {
            return response.json(); 
        });
    }

    createPrimativeSetFromPublicKey(publicKey) {
        const primitiveSet = new PrimitiveSet.PrimitiveSet();
        const entry = primitiveSet.addPrimitive(new HybridEncrypt(), publicKey);
        primitiveSet.setPrimary(entry);
        return primitiveSet;
    }

    async encryptDocumentKey(docKey, publicKey) {
        const primitiveSet = this.createPrimativeSetFromPublicKey(publicKey);
        const hybridEncrypt = new HybridEncryptWrapper().wrap(primitiveSet);
        const docKeyCiphertext = await hybridEncrypt.encrypt(docKey);
        return docKeyCiphertext;
    }

    addEncryptedDocumentKeyToHead(encryptedKey, parsedHtml) {
        let encryptedDocumentKeysNode = parsedHtml.CreateElement("script");
        encryptedDocumentKeysNode.setAttribute("type", "application/json");
        encryptedDocumentKeysNode.setAttribute("cryptokeys", "");
        const jsonKeys = {
            "google.com": encryptedKey
        };
        encryptedDocumentKeysNode.innerHTML = JSON.stringify(jsonKeys);
        parsedHtml.head.append(encryptedDocumentKeysNode);
    }
}