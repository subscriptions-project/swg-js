/* Script to encrypt documents for the SwG Encryption Project.

Golang script which takes in an input HTML document and encrypts
all content within <section subscriptions-section="content" encrypted>
tags using AES-GCM. The key used to encrypt the content is added
to the output document's head inside of a 
<script cryptokeys type="application/json"> element. The encrypted
document is outputted to the output_file path given as a flag.
*/
package main

import (
	"flag"
	"fmt"
	"io/ioutil"
	"os"
	"github.com/subscriptions-project/swg-js/encryption/encryptionutils"
)

func main() {
	// Input flags.
	html_file := flag.String("input_html_file", "", "Input HTML file to encrypt.")
	out_file := flag.String("output_file", "", "Output path to write encrypted HTML file.")
	access_requirement := flag.String("access_requirement", "", "The access requirement we grant upon decryption.")
	google_public_key_url := flag.String("google_public_key_url",
			"https://news.google.com/swg/encryption/keys/dev/tink/public_key",
			"URL to Google's public key.")
	flag.Parse()
	if *html_file == "" || *out_file == "" || *google_public_key_url == "" || *access_requirement == "" {
		fmt.Println("Missing flags!")
		os.Exit(42)
	}
	// Read the input HTML file.
	b, err := ioutil.ReadFile(*html_file)
    if err != nil {
		fmt.Println(err)
		os.Exit(42)
	}
	// Generate the encrypted document from the input HTML document.
	encrypted_doc, err := encryptionutils.GenerateEncryptedDocument(string(b), *google_public_key_url, *access_requirement)
	if err != nil {
		fmt.Println(err)
		os.Exit(42)
	}
	// Write the encrypted document to the output file.
	f, err := os.Create(*out_file)
	if err != nil {
		fmt.Println(err)
		os.Exit(42)
	}
	f.WriteString(encrypted_doc)
	fmt.Println("Encrypted HTML file generated successfully")
	os.Exit(0)
}