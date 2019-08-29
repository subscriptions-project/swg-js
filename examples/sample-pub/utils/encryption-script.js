/**
 * @fileoverview Description of this file.
 */

import {SwgEncryptionClient} from './encryption-helper.js';

main = function() {
    let argv = process.argv.slice(2);
    let fs = require("fs");
    fs.readFile(argv[0], (err, data) => {
        if (err) throw err;
        let swg_encryption = new SwgEncryptionClient();
        const encrypted_content = swg_encryption.generateEncryptedDocument(data);
        fs.writeFile(argv[1], encrypted_content, (err) => {
            if (err) throw err;
            console.log('The file has been saved!');
          });
    })
}

main();