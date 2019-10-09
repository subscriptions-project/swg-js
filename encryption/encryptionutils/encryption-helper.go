package encryptionutils

import (
	"bytes"
    "encoding/base64"
	"fmt"
	"io"
	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
	"github.com/golang/protobuf/proto"
	"github.com/google/tink/go/aead"
	"github.com/google/tink/go/hybrid"
	"github.com/google/tink/go/insecurecleartextkeyset"
	"github.com/google/tink/go/keyset"
	"github.com/google/tink/go/core/registry"
	gcmpb "github.com/google/tink/proto/aes_gcm_go_proto"
	tinkpb "github.com/google/tink/proto/tink_go_proto"
	"net/http"
	"strings"
)

const AES_GCM_KEY_URL string = "type.googleapis.com/google.crypto.tink.AesGcmKey" 
const AES_GCM_KEY_SIZE uint32 = 16

func GenerateEncryptedDocument(html_str string, public_key_url string, access_requirement string) (string, error) {
	keyManager, err := registry.GetKeyManager(AES_GCM_KEY_URL)
	if err != nil {
		return "", err
	}
	key, key_value := generateNewAesGcmKey(keyManager)
	if key == "" || key_value == "" {
		return "", fmt.Errorf("Could not generate new AES-GCM key.")
	}
	r := strings.NewReader(html_str)
	parsed_html, err := html.Parse(r)
	if err != nil {
		return "", err
	}
	encrypted_sections := getAllEncryptedSections(parsed_html)
	err = encryptAllSections(parsed_html, encrypted_sections, key)
	if err != nil {
		return "", err
	}
	google_public_key, err  := getGooglePublicKey(public_key_url)
	if err != nil {
		return "", err
	}
	encrypted_key, err := encryptDocumentKey(key_value, access_requirement, google_public_key)
	if err != nil {
		return "", err
	}
	if err := addEncryptedDocumentKeyToHead(encrypted_key, parsed_html); err != nil {
		return "", err
	}
	return renderNode(parsed_html, false), nil
}

func generateNewAesGcmKey(km registry.KeyManager) (string, string) {
	serialized_proto, _ := proto.Marshal(&gcmpb.AesGcmKeyFormat{KeySize: AES_GCM_KEY_SIZE})
	m, err := km.NewKey(serialized_proto)
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


func encryptAllSections(parsed_html *html.Node, encrypted_sections []*html.Node, key string) error {
	ks := createAesGcmKeyset([]byte(key))
	kh, err := insecurecleartextkeyset.Read(&keyset.MemReaderWriter{Keyset: &ks})
	if err != nil {
		return err
	}
	cipher, err := aead.New(kh)
	if err != nil {
		return err
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

func createAesGcmKeyset(key []byte) tinkpb.Keyset {
	keyData := tinkpb.KeyData{
		KeyMaterialType: tinkpb.KeyData_SYMMETRIC,
		TypeUrl: AES_GCM_KEY_URL,
		Value: key,
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

func getGooglePublicKey(public_key_url string) (tinkpb.Keyset, error) {
	resp, err := http.Get(public_key_url)
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

func encryptDocumentKey(doc_key string, access_requirement string, ks tinkpb.Keyset) (string, error) {
	handle, err := keyset.NewHandleWithNoSecrets(&ks)
	if err != nil {
		return "", err
	}
	he, err := hybrid.NewHybridEncrypt(handle)
    if err != nil {
        return "", err
	}
	json_str := fmt.Sprintf("{\"accessRequirements\": [\"%s\"], \"key\": \"%s\"}", access_requirement, doc_key)
	enc, err := he.Encrypt([]byte(json_str), nil)
	if err != nil {
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