package main

import (
	"flag"
	"fmt"
	"github.com/google/tink/go/aead"
	"io/ioutil"
	"os"
	"github.com/subscriptions-project/swg-js/encryption"
)

func main() {
	html_file := flag.String("input_html_file", "", "Input HTML file to encrypt.")
	out_file := flag.String("output_file", "", "Output path to write encrypted HTML file.")
	google_public_key_url := flag.String("google_public_key_url",
			"https://news.google.com/swg/encryption/keys/dev/tink/public_key",
			"URL to Google's public key.")
	b, err := ioutil.ReadFile(html_file)
    if err != nil {
		fmt.Print(err)
		os.Exit(42)
	}
	encrypted_doc, err := encryption.GenerateEncryptedDocument(string(b), google_public_key_url)
	if err != nil {
		fmt.Print(err)
		os.Exit(42)
	}
	f, err := os.Create(out_file)
	if err != nil {
		fmt.Print(err)
		os.Exit(42)
	}
	f.WriteString(encrypted_doc)
	fmt.Print("Encrypted HTML file generated successfully")
	os.Exit(0)
}