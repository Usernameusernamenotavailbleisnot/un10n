// fix-pubkey.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fix @cosmjs/tendermint-rpc responses.js files
const tendermintPaths = [
  path.join('node_modules', '@cosmjs', 'tendermint-rpc', 'build', 'tendermint37', 'adaptor', 'responses.js'),
  path.join('node_modules', '@cosmjs', 'tendermint-rpc', 'build', 'comet38', 'adaptor', 'responses.js')
];

tendermintPaths.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix the algorithm assertion
    content = content.replace(
      /(algorithm === "ed25519" \|\| algorithm === "secp256k1")/g, 
      '$1 || algorithm === "bn254"'
    );
    
    // Add PubKeyBn254 cases
    content = content.replace(
      /(default:\s+throw new Error\(`unknown pubkey type: \${data\.type}`\);)/g,
      'case "tendermint/PubKeyBn254":\n                return {\n                    algorithm: "bn254",\n                    data: (0, encoding_1.fromBase64)((0, encodings_1.assertNotEmpty)(data.value)),\n                };\n            case "cometbft/PubKeyBn254":\n                return {\n                    algorithm: "bn254",\n                    data: (0, encoding_1.fromBase64)((0, encodings_1.assertNotEmpty)(data.value)),\n                };\n            $1'
    );
    
    fs.writeFileSync(filePath, content);
    console.log(`Fixed ${filePath}`);
  } else {
    console.warn(`File not found: ${filePath}`);
  }
});

// Fix tendermintclient.js
const clientPath = path.join('node_modules', '@cosmjs', 'tendermint-rpc', 'build', 'tendermintclient.js');
if (fs.existsSync(clientPath)) {
  let content = fs.readFileSync(clientPath, 'utf8');
  
  // Add support for version 1.0.*
  content = content.replace(
    /(version\.startsWith\("0\.38\."\))/g,
    '$1 || version.startsWith("1.0.")'
  );
  
  fs.writeFileSync(clientPath, content);
  console.log(`Fixed ${clientPath}`);
} else {
  console.warn(`File not found: ${clientPath}`);
}

// Fix @cosmjs/amino pubkeys.js
const aminoPath = path.join('node_modules', '@cosmjs', 'amino', 'build', 'pubkeys.js');
if (fs.existsSync(aminoPath)) {
  let content = fs.readFileSync(aminoPath, 'utf8');
  
  // Add isBn254Pubkey function
  content = content.replace(
    /(exports\.isSecp256k1Pubkey = isSecp256k1Pubkey;)/g,
    '$1\nfunction isBn254Pubkey(pubkey) {\n    return pubkey.type === "tendermint/PubKeyBn254";\n}\nexports.isBn254Pubkey = isBn254Pubkey;'
  );
  
  // Add bn254 to pubkeyType
  content = content.replace(
    /(sr25519: "tendermint\/PubKeySr25519",)/g,
    '$1\n    bn254: "tendermint/PubKeyBn254",'
  );
  
  fs.writeFileSync(aminoPath, content);
  console.log(`Fixed ${aminoPath}`);
} else {
  console.warn(`File not found: ${aminoPath}`);
}

console.log('All fixes applied successfully!');