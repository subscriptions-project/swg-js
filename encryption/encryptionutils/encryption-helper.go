package encryptionutils

import (
	"bytes"
    "encoding/base64"
	// "encoding/json"
	"fmt"
	"io"
	// "io/ioutil"
	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
	"github.com/golang/protobuf/proto"
	// subtleAEAD "github.com/google/tink/go/subtle/aead"
	"github.com/google/tink/go/aead"
	"github.com/google/tink/go/hybrid"
	"github.com/google/tink/go/keyset"
	"github.com/google/tink/go/core/registry"
	gcmpb "github.com/google/tink/proto/aes_gcm_go_proto"
	tinkpb "github.com/google/tink/proto/tink_go_proto"
	"net/http"
	"strings"
)

func GenerateEncryptedDocument(html_str string, public_key_url string, access_requirement string) (string, error) {
	keyManager, err := registry.GetKeyManager("type.googleapis.com/google.crypto.tink.AesGcmKey")
	if err != nil {
		fmt.Println("1")
		return "", err
	}
	key, key_value := generateNewAesGcmKey(keyManager)
	if key == "" || key_value == "" {
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
	encrypted_key, err := encryptDocumentKey(key_value, access_requirement, google_public_key)
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

func generateNewAesGcmKey(km registry.KeyManager) (string, string) {
	serialized_proto, _ := proto.Marshal(&gcmpb.AesGcmKeyFormat{KeySize: 16})
	m, err := km.NewKey(serialized_proto)
	// key := m.(*gcmpb.AesGcmKey)
	if err != nil {
		fmt.Println("Error occurred creating new key.")
		return "", ""
	}
	b, err := proto.Marshal(m)
	if err != nil {
		fmt.Println("Error occurred creating new key.")
		return "", ""
	}
	return string(b), base64.StdEncoding.EncodeToString(b)
}

func getAllEncryptedSections(parsed_html *html.Node) []*html.Node {
	var encrypted_sections []*html.Node
	for n := parsed_html.FirstChild; n != nil; n = n.NextSibling {
		if (n.Data == "html") && (len(n.Attr) != 0) {
			fmt.Println("Hello everyone!")
			for bn := n.FirstChild; bn != nil; bn = bn.NextSibling {
				if (bn.Data == "body") {
					var stack []*html.Node
					stack = append(stack, bn)
					for {
						if len(stack) == 0 {
							break
						}
						n, stack = stack[len(stack)-1], stack[:len(stack)-1]
						if (n.Type == html.ElementNode && n.Data == "section") {
							var content_sub_section bool = false
							var encrypted bool = false
							for _, a := range n.Attr {
								if a.Key == "subscriptions-section" && a.Val == "content" {
									content_sub_section = true
								} else if a.Key == "encrypted" {
									encrypted = true
								}
							}
							if content_sub_section && encrypted {
								encrypted_sections = append(encrypted_sections, n)
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
	return encrypted_sections
}


func encryptAllSections(parsed_html *html.Node, encrypted_sections []*html.Node, key string, km registry.KeyManager) error {
	kh, err := keyset.NewHandle(aead.AES128GCMKeyTemplate())
	if err != nil {
		return err
	}
	cipher, err := aead.NewWithKeyManager(kh, km)
	if err != nil {
		return err
	}
	for _, node := range encrypted_sections {
		var content []string
		for c := node.FirstChild; c != nil; c = c.NextSibling {
			content = append(content, renderNode(c, true))
			node.RemoveChild(c)
		}
		fmt.Println("line!!!! ", strings.Join(content, ""))
		encrypted_content, encrypt_err := cipher.Encrypt([]byte(strings.Join(content, "")), nil)
		if encrypt_err != nil {
			return encrypt_err
		}
		text_node := &html.Node{Type: html.TextNode, Data: base64.StdEncoding.EncodeToString(encrypted_content)}
	    attrs := []html.Attribute{
			html.Attribute{Key: "type", Val: "application/octet-stream"},
			html.Attribute{Key: "ciphertext", Val: ""},
		}
		script_node := &html.Node{
			Type: html.ElementNode,
			Data:"script",
			DataAtom: atom.Script, 
			Attr: attrs,
		}
		node.AppendChild(script_node)
		script_node.AppendChild(text_node)
	}
	return nil
}

func getGooglePublicKey(public_key_url string) (tinkpb.Keyset, error) {
	resp, err := http.Get(public_key_url)
	if err != nil {
		fmt.Println("0.1")
		return tinkpb.Keyset{}, err
	}
	r := keyset.NewJSONReader(resp.Body)
	ks, err := r.Read()
	if err != nil {
		fmt.Println("0.2")
		return tinkpb.Keyset{}, err
	}
	return *ks, nil
	// var tink_json_key map[string]interface{}
	// if err = json.Unmarshal(body, &tink_json_key); err != nil {
	// 	return tinkpb.KeyData{}, err
	// }
	// key_material_type := tinkpb.KeyData_KeyMaterialType_value[tink_json_key["keyMaterialType"].(string)]
	// decoded_key, err := base64.StdEncoding.DecodeString(tink_json_key["value"].(string))
	// if err != nil {
	// 	fmt.Println("0.3")
	// 	return tinkpb.KeyData{}, err
	// }
	// keyData := tinkpb.KeyData{
	// 	KeyMaterialType: tinkpb.KeyData_KeyMaterialType(key_material_type),
	// 	TypeUrl: tink_json_key["typeUrl"].(string),
	// 	Value: decoded_key,
	// }
	// return keyData, nil
}

func encryptDocumentKey(doc_key string, access_requirement string, ks tinkpb.Keyset) (string, error) {
	// keys := []*tinkpb.Keyset_Key{
	// 	&tinkpb.Keyset_Key{
	// 		KeyData:          &public_key,
	// 		Status:           tinkpb.KeyStatusType_ENABLED,
	// 		KeyId:            3962548922,
	// 		OutputPrefixType: tinkpb.OutputPrefixType_CRUNCHY,
	// 	},
	// }
	// ks := &tinkpb.Keyset{
	// 	PrimaryKeyId: 3962548922,
	// 	Key:          keys,
	// }
	handle, err := keyset.NewHandleWithNoSecrets(&ks)
	if err != nil {
		fmt.Println("5.0")
		return "", err
	}
	he, err := hybrid.NewHybridEncrypt(handle)
    if err != nil {
		fmt.Println("5.1")
        return "", err
	}
	json_str := fmt.Sprintf("{\"accessRequirements\": [\"%s\"], \"key\": \"%s\"}", access_requirement, doc_key)
	fmt.Println(json_str)
	enc, err := he.Encrypt([]byte(json_str), nil)
	if err != nil {
		fmt.Println("5.2")
		return "", err
	}
	return base64.StdEncoding.EncodeToString(enc), nil
}

func addEncryptedDocumentKeyToHead(encrypted_key string, parsed_html *html.Node) error {
	for n := parsed_html.FirstChild; n != nil; n = n.NextSibling {
	if (n.Data == "html") && (len(n.Attr) != 0) {
		for cn := n.FirstChild; cn != nil; cn = cn.NextSibling {
			if (cn.Data == "head") {
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
				jsonData := fmt.Sprintf(`{"google.com":"%s"}`, encrypted_key)
				fmt.Println(jsonData)
				text_node := &html.Node{Type: html.TextNode, Data: jsonData}
				crypto_keys.AppendChild(text_node)
				cn.AppendChild(crypto_keys)
			    return nil
			}
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