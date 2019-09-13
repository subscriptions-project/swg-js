package encryption

import (
	"fmt"
	"golang.org/x/net/html"
	"github.com/golang/protobuf/proto"
	gcmpb "github.com/google/tink/proto/aes_gcm_go_proto"
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
	google_public_key := eh.getGooglePublicKey(PUBLIC_KEY_LOC)
	encrypted_key, err := eh.encryptDocumentKey(key, google_public_key)
	if err != nil {
		return html
	}
	eh.addEncryptedDocumentKeyToHead(encrypted_key, parsed_html)
	return parsed_html.innerHTML
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