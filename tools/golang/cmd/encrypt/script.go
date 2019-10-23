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
package main

import (
	"errors"
	"flag"
	tinkpb "github.com/google/tink/proto/tink_go_proto"
	"github.com/subscriptions-project/swg-js/tools/golang/encryption"
	"io/ioutil"
	"log"
	"os"
	"strings"
)

type mapFlags map[string]string

const googleDevPublicKeyUrl string = "https://news.google.com/swg/encryption/keys/dev/tink/public_key"

func (m *mapFlags) String() string {
	var strs []string
	for key, val := range *m {
		strs = append(strs, key, ",", val)
	}
	return strings.Join(strs, "\n")
}
func (m *mapFlags) Set(value string) error {
	s := strings.Split(value, ",")
	if len(s) != 2 {
		return errors.New("Malformed value inserted: " + value)
	}
	(*m)[s[0]] = s[1]
	return nil
}

// Script to encrypt documents for the SwG Encryption Project.
func main() {
	// Input flags.
	inputHtmlFile := flag.String("input_html_file", "", "Input HTML file to encrypt.")
	outFile := flag.String("output_file", "", "Output path to write encrypted HTML file.")
	accessRequirement := flag.String("access_requirement", "", "The access requirement we grant upon decryption.")
	mf := make(mapFlags)
	flag.Var(&mf, "encryption_key_url", `Strings in the form of '<domain-name>,<url>', where url is 
										 link to the hosted public key that we use to encrypt the 
										 document key.`)
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
	// Read the input HTML file.
	b, err := ioutil.ReadFile(*inputHtmlFile)
	if err != nil {
		log.Fatal(err)
	}
	// Retrieve all public keys from the input URLs.
	pubKeys := make(map[string]tinkpb.Keyset)
	var pubKey tinkpb.Keyset
	for domain, url := range mf {
		pubKey, err = encryption.RetrieveTinkPublicKey(url)
		if err != nil {
			log.Fatal(err)
		}
		pubKeys[strings.ToLower(domain)] = pubKey
	}
	if _, ok := pubKeys["google.com"]; !ok {
		googKey, err := encryption.RetrieveTinkPublicKey(googleDevPublicKeyUrl)
		if err != nil {
			log.Fatal(err)
		}
		pubKeys["google.com"] = googKey
	}
	// Generate the encrypted document from the input HTML document.
	encryptedDoc, err := encryption.GenerateEncryptedDocument(string(b), *accessRequirement, pubKeys)
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
}
