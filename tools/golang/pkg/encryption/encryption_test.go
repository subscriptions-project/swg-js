package encryption

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

var googPublicKeyStr string = `{"key":[
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

func TestGetTinkPublicKeySuccess(t *testing.T) {
	httpServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			t.Errorf("Download request was method %s; want GET", r.Method)
		}

		n, err := w.Write([]byte(googPublicKeyStr))
		if err != nil {
			t.Errorf("Failed to write fake response: %v", err)
		}
		if n != len([]byte(googPublicKeyStr)) {
			t.Errorf("Wrote %d bytes of fake response; want %d", n, len([]byte(googPublicKeyStr)))
		}
	}))
	defer httpServer.Close()
	pubKey, err := RetrieveTinkPublicKey(httpServer.URL)
	if err != nil {
		t.Errorf("Failed to retrieve Tink public key.")
	}
	if pubKey.PrimaryKeyId != 3962548922 {
		t.Errorf("Invalid primary key ID: %d", pubKey.PrimaryKeyId)
	}
	if pubKey.Key[0].KeyId != 3962548922 {
		t.Errorf("Invalid key ID found: %d", pubKey.Key[0].KeyId)
	}
}

func TestGetTinkPublicKeyGetFailure(t *testing.T) {
	httpServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			t.Errorf("Download request was method %s; want GET", r.Method)
		}
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer httpServer.Close()
	_, err := RetrieveTinkPublicKey(httpServer.URL)
	if err == nil {
		t.Errorf("Expected failure but call succeeded.")
	}
}