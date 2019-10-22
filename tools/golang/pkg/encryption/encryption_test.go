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
	"github.com/google/tink/go/keyset"
	tinkpb "github.com/google/tink/proto/tink_go_proto"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

const googPublicKeyStr string = `{"key":[
	{
		"keyData":{
			"keyMaterialType":"ASYMMETRIC_PUBLIC",
			"typeUrl":"type.googleapis.com/google.crypto.tink.EciesAeadHkdfPublicKey",
			"value":"EkQKBAgCEAMSOhI4CjB0eXBlLmdvb2dsZWFwaXMuY29tL2dvb2dsZS5jcnlwdG8udGluay5BZXNHY21LZXkSAhAQGAEYAxogIxtaOU5H2AVnQAYW5nIPWrMX1ORU9qQFfKTUMNyV0gEiIICIK5ak8rNbREV8i1RHMJQaWs5I8bqeGHukmRZls8pK"
			},
		"keyId":3962548922,
		"outputPrefixType":"CRUNCHY",
		"status":"ENABLED"
	}
	],
	"primaryKeyId":3962548922
}`

const googPrimaryKeyId uint32 = 3962548922

func loadTestFileString(filename string) (string, error) {
	path := filepath.Join("testdata", filename) // relative path
	bytes, err := ioutil.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

func TestRetrieveTinkPublicKeySuccess(t *testing.T) {
	httpServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			t.Fatalf("Download request was method %s; want GET", r.Method)
		}

		n, err := w.Write([]byte(googPublicKeyStr))
		if err != nil {
			t.Fatalf("Failed to write fake response: %v", err)
		}
		if n != len([]byte(googPublicKeyStr)) {
			t.Fatalf("Wrote %d bytes of fake response; want %d", n, len([]byte(googPublicKeyStr)))
		}
	}))
	defer httpServer.Close()
	pubKey, err := RetrieveTinkPublicKey(httpServer.URL)
	if err != nil {
		t.Fatalf("Failed to retrieve Tink public key.")
	}
	if pubKey.PrimaryKeyId != googPrimaryKeyId {
		t.Errorf("Invalid primary key ID %d. Want: %d", pubKey.PrimaryKeyId, googPrimaryKeyId)
	}
	if pubKey.Key[0].KeyId != googPrimaryKeyId {
		t.Errorf("Invalid key ID %d. Want: %d", pubKey.Key[0].KeyId, googPrimaryKeyId)
	}
}

func TestRetrieveTinkPublicKeyGetFailure(t *testing.T) {
	httpServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			t.Fatalf("Download request was method %s; want GET", r.Method)
		}
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer httpServer.Close()
	_, err := RetrieveTinkPublicKey(httpServer.URL)
	if err == nil {
		t.Fatalf("Expected failure but call succeeded.")
	}
}

func TestEncryptDocumentSuccess(t *testing.T) {
	htmlStr, err := loadTestFileString("sample_encryption.html")
	if err != nil {
		t.Fatalf("HTML file load failed.")
	}
	sr := strings.NewReader(googPublicKeyStr)
	r := keyset.NewJSONReader(sr)
	ks, err := r.Read()
	if err != nil {
		t.Fatalf("Keyset load failed.")
	}
	pubKeys := map[string]tinkpb.Keyset{
		"google.com": *ks,
	}
	encDoc, err := GenerateEncryptedDocument(htmlStr, "norcal.com:premium", pubKeys)
	if err != nil {
		t.Fatalf("Error occured generating encrypted document.")
	}
	if !strings.Contains(encDoc, `<script type="application/octet-stream" ciphertext="">`) {
		t.Errorf("Missing encrypted script.")
	}
	if !strings.Contains(encDoc, `<script type="application/json" cryptokeys="">`) {
		t.Errorf("Missing cryptokeys script.")
	}
	if !strings.Contains(encDoc, "google.com") {
		t.Errorf("Missing google.com key.")
	}
}

func TestEncryptDocumentEmptyKeyset(t *testing.T) {
	htmlStr, err := loadTestFileString("sample_encryption.html")
	if err != nil {
		t.Fatalf("HTML file load failed.")
	}
	pubKeys := map[string]tinkpb.Keyset{
		"google.com": tinkpb.Keyset{},
	}
	_, err = GenerateEncryptedDocument(htmlStr, "norcal.com:premium", pubKeys)
	if err == nil {
		t.Fatalf("Error did not occur on empty Keyset.")
	}
}
