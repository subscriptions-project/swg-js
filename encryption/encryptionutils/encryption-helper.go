package encryptionutils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
	"github.com/golang/protobuf/proto"
	subtleAEAD "github.com/google/tink/go/subtle/aead"
	"github.com/google/tink/go/hybrid"
	"github.com/google/tink/go/keyset"
	"github.com/google/tink/go/core/registry"
	gcmpb "github.com/google/tink/proto/aes_gcm_go_proto"
	eahpb "github.com/google/tink/proto/ecies_aead_hkdf_go_proto"
	tinkpb "github.com/google/tink/proto/tink_go_proto"
	"net/http"
	"strings"
)

func GenerateEncryptedDocument(html_str string, public_key_url string) (string, error) {
	keyManager, err := registry.GetKeyManager("type.googleapis.com/google.crypto.tink.AesGcmKey")
	if err != nil {
		fmt.Println("1")
		return "", err
	}
	key := generateNewAesGcmKey(keyManager)
	if key == "" {
		return "", fmt.Errorf("Could not generate new AES-GCM key.")
	}
	r := strings.NewReader(html_str)
	parsed_html, err := html.Parse(r)
	if err != nil {
		fmt.Println("2")
		return "", err
	}
	encrypted_sections := getAllEncryptedSections(parsed_html)
	err = encryptAllSections(parsed_html, encrypted_sections, key, keyManager)
	if err != nil {
		fmt.Println("3")
		return "", err
	}
	google_public_key, err  := getGooglePublicKey(public_key_url)
	if err != nil {
		fmt.Println("4")
		return "", err
	}
	encrypted_key, err := encryptDocumentKey(key, google_public_key)
	if err != nil {
		fmt.Println("5")
		return "", err
	}
	if err := addEncryptedDocumentKeyToHead(encrypted_key, parsed_html); err != nil {
		fmt.Println("6")
		return "", err
	}
	return renderNode(parsed_html, false), nil
}

func generateNewAesGcmKey(km registry.KeyManager) string {
	serialized_proto, _ := proto.Marshal(&gcmpb.AesGcmKeyFormat{KeySize: 16})
	m, err := km.NewKey(serialized_proto)
	if err != nil {
		fmt.Println("Error occurred creating new key.")
		return ""
	}
	b, err := proto.Marshal(m)
	if err != nil {
		fmt.Println("Error occurred creating new key.")
		return ""
	}
	return string(b)
}

func getAllEncryptedSections(parsed_html *html.Node) []*html.Node {
	var encrypted_sections []*html.Node
	if (parsed_html.FirstChild != nil) && (parsed_html.FirstChild.Data == "html") {
		var in_body bool = false
		for node := parsed_html.FirstChild.FirstChild; node != nil; node = node.NextSibling {
			if !in_body {
				if (node.Data == "body") {
					in_body = true
				}
			} else {
				if (node.Type == html.ElementNode && node.Data == "section") {
					var content_sub_section bool = false
					var encrypted bool = false
					for _, a := range node.Attr {
						if a.Key == "subscriptions-section" && a.Val == "content" {
							content_sub_section = true
						} else if a.Key == "encrypted" {
							encrypted = true
						}
					}
					if content_sub_section && encrypted {
						encrypted_sections = append(encrypted_sections, node)
					}
				}
			}
		}
	}
	return encrypted_sections
}

func encryptAllSections(parsed_html *html.Node, encrypted_sections []*html.Node, key string, km registry.KeyManager) error {
	aesgcm, prim_err := km.Primitive([]byte(key))
	cipher := aesgcm.(*subtleAEAD.AESGCM)
	if prim_err != nil {
		return prim_err
	}
	for _, node := range encrypted_sections {
		var content []string
		for c := node.FirstChild; c != nil; c = c.NextSibling {
			content = append(content, renderNode(c, true))
			node.RemoveChild(c)
		}
		encrypted_content, encrypt_err := cipher.Encrypt([]byte(strings.Join(content, "")), nil)
		if encrypt_err != nil {
			return encrypt_err
		}
		text_node := &html.Node{Type: html.TextNode, Data: string(encrypted_content)}
		node.AppendChild(text_node)
	}
	return nil
}

func getGooglePublicKey(public_key_url string) (tinkpb.KeyData, error) {
	resp, err := http.Get(public_key_url)
	if err != nil {
		return tinkpb.KeyData{}, err
	}
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return tinkpb.KeyData{}, err
	}
	var tink_json_key map[string]interface{}
	if err = json.Unmarshal(body, &tink_json_key); err != nil {
		return tinkpb.KeyData{}, err
	}
	key_material_type := tinkpb.KeyData_KeyMaterialType_value[tink_json_key["keyMaterialType"].(string)]
	keydata := new(eahpb.EciesAeadHkdfPublicKey)
	if err := proto.Unmarshal([]byte(tink_json_key["value"].(string)), keydata); err != nil {
		return tinkpb.KeyData{}, err
	}
	buf, _ := proto.Marshal(keydata)
	keyData := tinkpb.KeyData{
		KeyMaterialType: tinkpb.KeyData_KeyMaterialType(key_material_type),
		TypeUrl: tink_json_key["typeUrl"].(string),
		Value: buf,
	}
	return keyData, nil
}

func encryptDocumentKey(doc_key string, public_key tinkpb.KeyData) (string, error) {
	keys := []*tinkpb.Keyset_Key{
		&tinkpb.Keyset_Key{
			KeyData:          &public_key,
			Status:           tinkpb.KeyStatusType_ENABLED,
			KeyId:            1,
			OutputPrefixType: tinkpb.OutputPrefixType_TINK,
		},
	}
	ks := &tinkpb.Keyset{
		PrimaryKeyId: 1,
		Key:          keys,
	}
	fmt.Println(ks.String())
	handle, err := keyset.NewHandleWithNoSecrets(ks)
	if err != nil {
		fmt.Println("5.0")
		return "", err
	}
	he, err := hybrid.NewHybridEncrypt(handle)
    if err != nil {
		fmt.Println("5.1")
        return "", err
    }
	enc, err := he.Encrypt([]byte(doc_key), nil)
	if err != nil {
		fmt.Println("5.2")
		return "", err
	}
	return string(enc), nil
}

func addEncryptedDocumentKeyToHead(encrypted_key string, parsed_html *html.Node) error {
	if (parsed_html.FirstChild != nil) && (parsed_html.FirstChild.Data == "html") {
		for node := parsed_html.FirstChild.FirstChild; node != nil; node = node.NextSibling {
			if (node.Data == "head") {
				attrs := []html.Attribute{
					html.Attribute{Key: "type", Val: "application/json"},
					html.Attribute{Key: "cryptokeys", Val: ""},
				}
				crypto_keys := &html.Node{
					Type: html.ElementNode,
					Data:"script",
					DataAtom: atom.Script, 
					Attr: attrs,
				}
				jsonData := fmt.Sprintf(`{"google.com":"%s"`, encrypted_key)
				text_node := &html.Node{Type: html.TextNode, Data: jsonData}
				crypto_keys.AppendChild(text_node)
				node.AppendChild(crypto_keys)
			    return nil
			}
		}
	}
	return fmt.Errorf("Could not add cryptokeys to head.")
}

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