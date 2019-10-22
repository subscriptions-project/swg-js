/* Copyright 2019 The Subscribe with Google Authors. All Rights Reserved.
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
package encryption

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
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
	"net/http"
	"strings"
	"unicode/utf8"
)

// Helper functions for the SwG Encryption Script.

const aesGcmKeyUrl string = "type.googleapis.com/google.crypto.tink.AesGcmKey"
const aesGcmKeySize uint32 = 16

// Public function to generate an encrypted HTML document given the original.
func GenerateEncryptedDocument(htmlStr, accessRequirement string, pubKeys map[string]tinkpb.Keyset) (string, error) {
	km, err := registry.GetKeyManager(aesGcmKeyUrl)
	if err != nil {
		return "", err
	}
	key, err := generateNewAesGcmKey(km)
	if err != nil {
		return "", err
	}
	ks := createAesGcmKeyset(key)
	ksEnc, err := proto.Marshal(&ks)
	if err != nil {
		return "", err
	}
	kh, err := insecurecleartextkeyset.Read(&keyset.MemReaderWriter{Keyset: &ks})
	if err != nil {
		return "", err
	}
	parsedHtml, err := html.Parse(strings.NewReader(htmlStr))
	if err != nil {
		return "", err
	}
	encryptedSections := getAllEncryptedSections(parsedHtml)
	if len(encryptedSections) == 0 {
		return "", errors.New("No encrypted sections found.")
	}
	if err = encryptAllSections(parsedHtml, encryptedSections, kh); err != nil {
		return "", err
	}
	encryptedKeys, err := encryptDocumentKey(base64.StdEncoding.EncodeToString(ksEnc), accessRequirement, pubKeys)
	if err != nil {
		return "", err
	}
	if err = addEncryptedDocumentKeyToHead(encryptedKeys, parsedHtml); err != nil {
		return "", err
	}
	return renderNode(parsedHtml), nil
}

// Retrieves a Tink public key from the given URL.
func RetrieveTinkPublicKey(publicKeyUrl string) (tinkpb.Keyset, error) {
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
// Example output proto:
// 		primary_key_id: 1
// 		key: <
// 			key_data: <
//   			type_url: "type.googleapis.com/google.crypto.tink.AesGcmKey"
//   			value: "\032\020\355\323'\277\341\241u\020w\322\177\207\357\374\301/"
//   			key_material_type: SYMMETRIC
// 			>
// 			status: ENABLED
// 			key_id: 1
// 			output_prefix_type: TINK
// 		>
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
	for n := parsedHtml.FirstChild; n != nil; n = n.NextSibling {
		if (n.DataAtom == atom.Html) && (len(n.Attr) != 0) {
			for bn := n.FirstChild; bn != nil; bn = bn.NextSibling {
				if bn.DataAtom == atom.Body {
					return getEncryptedSectionsDfs(bn)
				}
			}
		}
	}
	return nil
}

// Searches for all <section subscriptions-section="content" encrypted> nodes and returns them.
func getEncryptedSectionsDfs(bodyNode *html.Node) []*html.Node {
	var encryptedSections []*html.Node
	var queue []*html.Node
	var n *html.Node
	queue = append(queue, bodyNode)
	for {
		if len(queue) == 0 {
			break
		}
		n, queue = queue[len(queue)-1], queue[:len(queue)-1]
		if n.Type == html.ElementNode && n.DataAtom == atom.Section {
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
			queue = append(queue, cn)
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
			content = append(content, renderNode(c))
			node.RemoveChild(c)
		}
		b := []byte(strings.Join(content, ""))
		if !utf8.Valid(b) {
			return errors.New("Content contains invalid UTF-8.")
		}
		encContent, err := cipher.Encrypt(b, nil)
		if err != nil {
			return err
		}
		textNode := &html.Node{Type: html.TextNode, Data: base64.StdEncoding.EncodeToString(encContent)}
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

type swgEncryptionKey struct {
	accessRequirement []string
	key               string
}

// Encrypts the document's symmetric key using the input Keyset.
func encryptDocumentKey(docKeyset, accessRequirement string, pubKeys map[string]tinkpb.Keyset) (map[string]string, error) {
	outMap := make(map[string]string)
	for domain, ks := range pubKeys {
		handle, err := keyset.NewHandleWithNoSecrets(&ks)
		if err != nil {
			return nil, err
		}
		he, err := hybrid.NewHybridEncrypt(handle)
		if err != nil {
			return nil, err
		}
		swgKey := swgEncryptionKey{
			accessRequirement: []string{accessRequirement},
			key:               docKeyset,
		}
		jsonData, err := json.Marshal(swgKey)
		if err != nil {
			return nil, err
		}
		enc, err := he.Encrypt(jsonData, nil)
		if err != nil {
			return nil, err
		}
		outMap[domain] = base64.StdEncoding.EncodeToString(enc)
	}
	return outMap, nil
}

// Adds the encrypted document keys to the output document's head.
func addEncryptedDocumentKeyToHead(encryptedKeys map[string]string, parsedHtml *html.Node) error {
	for n := parsedHtml.FirstChild; n != nil; n = n.NextSibling {
		if (n.DataAtom == atom.Html) && (len(n.Attr) != 0) {
			for cn := n.FirstChild; cn != nil; cn = cn.NextSibling {
				if cn.DataAtom == atom.Head {
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
					jsonEncKeys, err := json.Marshal(encryptedKeys)
					if err != nil {
						return err
					}
					textNode := &html.Node{Type: html.TextNode, Data: string(jsonEncKeys)}
					cryptoKeys.AppendChild(textNode)
					cn.AppendChild(cryptoKeys)
					return nil
				}
			}
		}
	}
	return errors.New("Could not add cryptokeys to head.")
}

// Renders the input Node to a string.
func renderNode(n *html.Node) string {
	b := new(bytes.Buffer)
	html.Render(b, n)
	return b.String()
}
