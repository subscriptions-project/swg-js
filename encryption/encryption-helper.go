package encryption

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
	"github.com/golang/protobuf/proto"
	"github.com/google/tink/go/core/primitiveset"
	"github.com/google/tink/go/hybrid/hybrid_encrypt_factory"
	gcmpb "github.com/google/tink/proto/aes_gcm_go_proto"
	"github.com/google/tink/go/tink"
	"net/http"
	"strings"
)

type encryptionHelper struct{
	aesGcmKeyManager *aead.aesGcmKeyManager
}

func (eh *encryptionHelper) generateEncryptedDocument(html string) string {
	key := eh.generateNewAesGcmKey()
	if key == "" {
		return html
	}
	r := strings.NewReader(html)
	parsed_html := html.Parse(r)
	if err != nil {
		fmt.Println("Unparsable HTML.")
		return html
	}
	encrypted_sections := eh.getAllEncryptedSections(parsed_html)
	err_encrypt := eh.encryptAllSections(parsed_html, encrypted_sections)
	if err_encrypt != nil {
		return html
	}
	google_public_key, err  := eh.getGooglePublicKey(PUBLIC_KEY_LOC)
	if err != nil {
		return html
	}
	encrypted_key, err := eh.encryptDocumentKey(key, google_public_key)
	if err != nil {
		return html
	}
	if err := eh.addEncryptedDocumentKeyToHead(encrypted_key, parsed_html); err != nil {
		return html
	}
	return renderNode(parsed_html, false)
}

func (eh *encryptionHelper) generateNewAesGcmKey() string {
	serialized_proto, _ := proto.Marshal(&gcmpb.AesGcmKeyFormat{KeySize: 16})
	m, err := eh.aesGcmKeyManager.NewKey(serialized_proto)
	if err != nil {
		fmt.Println("Error occurred creating new key.")
		return ""
	}
	return m.(*gcmpb.AesGcmKey)
}

func (eh *encryptionHelper) getAllEncryptedSections(parsed_html *html.Node) []*html.Node {
	var encrypted_sections []*html.Node
	if (parsed_html.FirstChild != nil) && (parsed_html.FirstChild.Data == "html") {
		var in_body bool = false
		for node := parsed_html.FirstChild.FirstChild; node != nil; node = node.NextSibling) {
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

func (eh *encryptionHelper) encryptAllSections(parsed_html *html.Node, encrypted_sections []*html.Node, key string) error {
	aead, prim_err := eh.aesGcmKeyManager.Primitive(key)
	if prim_err != nil {
		return prim_err
	}
	for _, node := range encrypted_sections {
		var content []string
		for c := node.FirstChild; c != nil; c = c.NextSibling {
			content = append(content, renderNode(c, true))
			node.RemoveChild(c)
		}
		encrypted_content, encrypt_err := aead.Encrypt([]byte(strings.Join(content, "")), nil)
		if encrypt_err != nil {
			return encrypt_err
		}
		text_node := &html.Node{Type: html.TextNode, Data: encrypted_content}
		node.AppendChild(text_node)
	}
}

func (eh *encryptionHelper) getGooglePublicKey(public_key_url string) (map[string]interface{}, error) {
	resp, err := http.Get(public_key_url)
	if err != nil {
		return nil, err
	}
	var dat map[string]interface{}
	if err := json.Unmarshal(resp.Body, &dat); err != nil {
		return err
	}
	return dat, nil
}

func (eh *encryptionHelper) encryptDocumentKey(doc_key string, public_key map[string]interface{}) (string, error) {
	ps := primitiveset.New()
	entry, err := ps.Add(tink.HybridEncrypt, public_key)
	if err != nil {
		return nil, err
	}
	ps.Primary = entry
	client := hybrid_encrypt_factory.newEncryptPrimitiveSet(ps)
	enc, err := client.Encrypt(doc_key, nil)
	if err != nil {
		return nil, err
	}
	return enc.ToString(), nil
}

func (eh *encryptionHelper) addEncryptedDocumentKeyToHead(encrypted_key string, parsed_html *html.Node) error {
	if (parsed_html.FirstChild != nil) && (parsed_html.FirstChild.Data == "html") {
		for node := parsed_html.FirstChild.FirstChild; node != nil; node = node.NextSibling) {
				if (node.Data == "head") {
					crypto_keys := &html.Node{Type: html.ElementNode, Data:"script", DataAtom: atom.Script, Attr: html.Attribute{type: "application/json", cryptokeys: ""}}
					jsonData := []byte(frm.Sprintf(`{"google.com":"%s"`, encrypted_key))
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
	s := buf.ToString()
	if trim {
		s = strings.TrimPrefix(s, "<html><body>")
		s = strings.TrimSuffix(s, "</body></html>")
	}
	return s
}