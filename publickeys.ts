import { Keypair } from "@solana/web3.js"
import { holderWalletName } from "./settings"
import fs from 'fs'
import base58 from "bs58"

const readHolderWallets = (filename: string) => {
    const filePath: string = `wallets/${filename}.json`

    try {
        // Check if the file exists
        if (fs.existsSync(filePath)) {
            // Read the file content
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const wallets = JSON.parse(fileContent);
            return wallets;
        } else {
            console.log(`File ${filePath} does not exist.`);
            return [];
        }
    } catch (error) {
        console.log('Error reading data from JSON file:', error);
        return [];
    }
};

const main = () => {
    const holderWallets = readHolderWallets(holderWalletName)
    const holderKps = holderWallets.map((privateKey: string) => Keypair.fromSecretKey(base58.decode(privateKey)))

    for (let i = 0; i < holderKps.length; i++) {
        console.log(holderKps[i].publicKey)
    }
}

main()