# Script to Encrypt Documents for the SwG Encryption Project

This script takes in an input HTML document and encrypts
all content within ```<section subscriptions-section="content" encrypted>```
tags using [AES-GCM](https://en.wikipedia.org/wiki/Galois/Counter_Mode). 
The key used to encrypt the content is added
to the output document's head inside of a
```<script cryptokeys type="application/json">``` element. The encrypted
document is outputted to the output_file path given as a flag.

## Example Usage:

```
go get github.com/subscriptions-project/swg-js/tools/golang/cmd/encrypt && \
$GOPATH/bin/encrypt \
    --input_html_file=../tmp/sample-encryption.html \
	--output_file=../tmp/sample-encryption-out.html \
	--google_public_key_url=https://news.google.com/swg/encryption/keys/{dev|prod}/tink/public_key \
	--access_requirement=thenews.com:premium \
	--publisher_public_key_url=example.com,www.example.com/scs/publickey \
    --publisher_public_key_url=thenews.com,www.thenews.com/scs/publickey
```
    
Or...

```
go run swg-js/tools/golang/cmd/encrypt/script.go \
	--input_html_file=../tmp/sample-encryption.html \
	--output_file=../tmp/sample-encryption-out.html \
	--google_public_key_url=https://news.google.com/swg/encryption/keys/{dev|prod}/tink/public_key \
	--access_requirement=norcal.com:premium \
	--publisher_public_key_url=example.com,www.example.com/scs/publickey \
	--publisher_public_key_url=thenews.com,www.thenews.com/scs/publickey
```