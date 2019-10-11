/* Copyright 2018 The Subscribe with Google Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package encryptionutils

import (
        "bytes"
        "encoding/base64"
        "fmt"
        "github.com/golang/protobuf/proto"
        "github.com/google/tink/go/aead"
        "github.com/google/tink/go/core/registry"
        "github.com/google/tink/go/hybrid"
        "github.com/google/tink/go/insecurecleartextkeyset"
        "github.com/google/tink/go/keyset"
        gcmpb "github.com/google/tink/proto/aes_gcm_go_proto"
        tinkpb "github.com/google/tink/proto/tink_go_proto"
        "golang.org/x/net/html"
        "golang.org/x/net/html/atom"
        "io"
        "net/http"
        "strings"
)

// Helper functions for the SwG Encryption Script.

const aesGcmKeyUrl string = "type.googleapis.com/google.crypto.tink.AesGcmKey"
const aesGcmKeySize uint32 = 16

// Public function to generate an encrypted HTML document given the original.
func GenerateEncryptedDocument(htmlStr, publicKeyUrl, accessRequirement string) (string, error) {
        km, err := registry.GetKeyManager(aesGcmKeyUrl)
        if err != nil {
                return "", err
        }
        key, err := generateNewAesGcmKey(km)
        if err != nil {
                return "", err
        }
        ks := createAesGcmKeyset(key)
        parsedHtml, err := html.Parse(strings.NewReader(htmlStr))
        if err != nil {
                return "", err
        }
        encryptedSections := getAllEncryptedSections(parsedHtml)
        kh, err := insecurecleartextkeyset.Read(&keyset.MemReaderWriter{Keyset: &ks})
        if err != nil {
                return "", err
        }
        err = encryptAllSections(parsedHtml, encryptedSections, kh)
        if err != nil {
                return "", err
        }
        pubKey, err := getGooglePublicKey(publicKeyUrl)
        if err != nil {
                return "", err
        }
        ksEnc, err := proto.Marshal(&ks)
        if err != nil {
                return "", err
        }
        encryptedKey, err := encryptDocumentKey(base64.StdEncoding.EncodeToString(ksEnc), accessRequirement, pubKey)
        if err != nil {
                return "", err
        }
        if err := addEncryptedDocumentKeyToHead(encryptedKey, parsedHtml); err != nil {
                return "", err
        }
        return renderNode(parsedHtml, false), nil
}

// Generates a new AES-GCM key.
func generateNewAesGcmKey(km registry.KeyManager) ([]byte, error) {
		p, err := proto.Marshal(&gcmpb.AesGcmKeyFormat{KeySize: aesGcmKeySize})
		if err != nil {
				return nil, err
		}
        m, err := km.NewKey(p)
        if err != nil {
                return nil, err
        }
        return proto.Marshal(m)
}

// Creates an AES-GCM Keyset using the input key.
func createAesGcmKeyset(key []byte) tinkpb.Keyset {
        keyData := tinkpb.KeyData{
                KeyMaterialType: tinkpb.KeyData_SYMMETRIC,
                TypeUrl:         aesGcmKeyUrl,
                Value:           key,
        }
        keys := []*tinkpb.Keyset_Key{
                &tinkpb.Keyset_Key{
                        KeyData:          &keyData,
                        Status:           tinkpb.KeyStatusType_ENABLED,
                        KeyId:            1,
                        OutputPrefixType: tinkpb.OutputPrefixType_TINK,
                },
        }
        return tinkpb.Keyset{
                PrimaryKeyId: 1,
                Key:          keys,
        }
}

// Retrieves all encrypted content sections from the parsed HTML tree.
func getAllEncryptedSections(parsedHtml *html.Node) []*html.Node {
        var encryptedSections []*html.Node
        for n := parsedHtml.FirstChild; n != nil; n = n.NextSibling {
                if (n.DataAtom == "html") && (len(n.Attr) != 0) {
                        for bn := n.FirstChild; bn != nil; bn = bn.NextSibling {
                                if bn.DataAtom == "body" {
                                        var stack []*html.Node
                                        stack = append(stack, bn)
                                        for {
                                                if len(stack) == 0 {
                                                        break
                                                }
                                                n, stack = stack[len(stack)-1], stack[:len(stack)-1]
                                                if n.Type == html.ElementNode && n.DataAtom == "section" {
                                                        var contentSubSection bool = false
                                                        var encrypted bool = false
                                                        for _, a := range n.Attr {
                                                                if a.Key == "subscriptions-section" && a.Val == "content" {
                                                                        contentSubSection = true
                                                                } else if a.Key == "encrypted" {
                                                                        encrypted = true
                                                                }
                                                        }
                                                        if contentSubSection && encrypted {
                                                                encryptedSections = append(encryptedSections, n)
                                                        }
                                                }
                                                for cn := n.FirstChild; cn != nil; cn = cn.NextSibling {
                                                        stack = append(stack, cn)
                                                }
                                        }
                                }
                        }
                }
        }
        return encryptedSections
}

// Encrypts the content inside of the input "encryptedSections" nodes.
func encryptAllSections(parsedHtml *html.Node, encryptedSections []*html.Node, kh *keyset.Handle) error {
        cipher, err := aead.New(kh)
        if err != nil {
                return err
        }
        for _, node := range encryptedSections {
                var content []string
                for c := node.FirstChild; c != nil; c = c.NextSibling {
                        content = append(content, renderNode(c, true))
                        node.RemoveChild(c)
                }
                encryptedContent, err := cipher.Encrypt([]byte(strings.Join(content, "")), nil)
                if err != nil {
                        return err
                }
                textNode := &html.Node{Type: html.TextNode, Data: base64.StdEncoding.EncodeToString(encryptedContent)}
                attrs := []html.Attribute{
                        html.Attribute{Key: "type", Val: "application/octet-stream"},
                        html.Attribute{Key: "ciphertext", Val: ""},
                }
                scriptNode := &html.Node{
                        Type:     html.ElementNode,
                        Data:     "script",
                        DataAtom: atom.Script,
                        Attr:     attrs,
                }
                node.AppendChild(scriptNode)
                scriptNode.AppendChild(textNode)
        }
        return nil
}

// Retrieves Google's public key from the given URL.
func getGooglePublicKey(publicKeyUrl string) (tinkpb.Keyset, error) {
        resp, err := http.Get(publicKeyUrl)
        if err != nil {
                return tinkpb.Keyset{}, err
        }
        r := keyset.NewJSONReader(resp.Body)
        ks, err := r.Read()
        if err != nil {
                return tinkpb.Keyset{}, err
        }
        return *ks, nil
}

// Encrypts the document's symmetric key using the input Keyset.
func encryptDocumentKey(docKeyset, accessRequirement string, ks tinkpb.Keyset) (string, error) {
        handle, err := keyset.NewHandleWithNoSecrets(&ks)
        if err != nil {
                return "", err
        }
        he, err := hybrid.NewHybridEncrypt(handle)
        if err != nil {
                return "", err
        }
        jsonStr := fmt.Sprintf("{\"accessRequirements\": [\"%s\"], \"key\": \"%s\"}", accessRequirement, docKeyset)
        enc, err := he.Encrypt([]byte(jsonStr), nil)
        if err != nil {
                return "", err
        }
        return base64.StdEncoding.EncodeToString(enc), nil
}

// Adds the encrypted document key to the output document's head.
func addEncryptedDocumentKeyToHead(encryptedKey string, parsedHtml *html.Node) error {
        for n := parsedHtml.FirstChild; n != nil; n = n.NextSibling {
                if (n.DataAtom == "html") && (len(n.Attr) != 0) {
                        for cn := n.FirstChild; cn != nil; cn = cn.NextSibling {
                                if cn.DataAtom == "head" {
                                        attrs := []html.Attribute{
                                                html.Attribute{Key: "type", Val: "application/json"},
                                                html.Attribute{Key: "cryptokeys", Val: ""},
                                        }
                                        cryptoKeys := &html.Node{
                                                Type:     html.ElementNode,
                                                Data:     "script",
                                                DataAtom: atom.Script,
                                                Attr:     attrs,
                                        }
                                        jsonData := fmt.Sprintf(`{"google.com":"%s"}`, encryptedKey)
                                        textNode := &html.Node{Type: html.TextNode, Data: jsonData}
                                        cryptoKeys.AppendChild(textNode)
                                        cn.AppendChild(cryptoKeys)
                                        return nil
                                }
                        }
                }
        }
        return fmt.Errorf("Could not add cryptokeys to head.")
}

// Renders the input Node to a string.
func renderNode(n *html.Node, trim bool) string {
        var buf bytes.Buffer
        w := io.Writer(&buf)
        html.Render(w, n)
        s := buf.String()
        if trim {
                s = strings.TrimPrefix(s, "<html><body>")
                s = strings.TrimSuffix(s, "</body></html>")
        }
        return s
}