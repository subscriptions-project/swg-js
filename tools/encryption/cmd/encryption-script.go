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
package main

import (
	"flag"
	"github.com/subscriptions-project/swg-js/tools/encryption/pkg"
	"io/ioutil"
	"log"
	"os"
)

/* Script to encrypt documents for the SwG Encryption Project.
*
* Golang script which takes in an input HTML document and encrypts
* all content within <section subscriptions-section="content" encrypted>
* tags using AES-GCM. The key used to encrypt the content is added
* to the output document's head inside of a
* <script cryptokeys type="application/json"> element. The encrypted
* document is outputted to the output_file path given as a flag.
 */
func main() {
	// Input flags.
	inputHtmlFile := flag.String("input_html_file", "", "Input HTML file to encrypt.")
	outFile := flag.String("output_file", "", "Output path to write encrypted HTML file.")
	accessRequirement := flag.String("access_requirement", "", "The access requirement we grant upon decryption.")
	googlePublicKeyUrl := flag.String("google_public_key_url",
		"https://news.google.com/swg/encryption/keys/dev/tink/public_key",
		"URL to Google's public key.")
	flag.Parse()
	if *inputHtmlFile == "" {
		log.Fatal("Missing flag: input_html_file")
	}
	if *outFile == "" {
		log.Fatal("Missing flag: output_file")
	}
	if *accessRequirement == "" {
		log.Fatal("Missing flag: access_requirement")
	}
	if *googlePublicKeyUrl == "" {
		log.Fatal("Missing flag: google_public_key_url")
	}
	// Read the input HTML file.
	b, err := ioutil.ReadFile(*inputHtmlFile)
	if err != nil {
		log.Fatal(err)
	}
	// Retrieve Google's public key from the input URL.
	pubKey, err := pkg.RetrieveGooglePublicKey(*googlePublicKeyUrl)
	if err != nil {
		log.Fatal(err)
	}
	// Generate the encrypted document from the input HTML document.
	encryptedDoc, err := pkg.GenerateEncryptedDocument(string(b), *accessRequirement, &pubKey)
	if err != nil {
		log.Fatal(err)
	}
	// Write the encrypted document to the output file.
	f, err := os.Create(*outFile)
	if err != nil {
		log.Fatal(err)
	}
	f.WriteString(encryptedDoc)
	log.Println("Encrypted HTML file generated successfully")
	os.Exit(0)
}
