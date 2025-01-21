import { connection } from "../config"
import bs58 from "bs58"
import {
    Keypair,
    PublicKey,
} from "@solana/web3.js"
import {
    getAssociatedTokenAddressSync
} from "@solana/spl-token";
import { bundlerWalletName, distNum, holderWalletName, LP_wallet_keypair, remaining_token_percent, tokens } from "../settings";
import { readBundlerWallets, readHolderWallets, readJson, sleep, tokenHoldersWaiting } from "../src/utils";
import { newSendToken } from "../src/sendBulkToken";
import { generateDistribution } from "../src/distribute";

const mainKp = LP_wallet_keypair
const mainPk = mainKp.publicKey

export const holder_distribute = async () => {
    try {
        const bundlerWallets: string[] = readBundlerWallets(bundlerWalletName)
        const holderWallets = readHolderWallets(holderWalletName)
        const data = readJson()
        const baseMint = new PublicKey(data.mint!)

        for(let i = 0; i < bundlerWallets.length; i ++) {
            const kp = Keypair.fromSecretKey(bs58.decode(bundlerWallets[i]))
            const tokenAta = getAssociatedTokenAddressSync(baseMint, kp.publicKey)
            const balance = (await connection.getTokenAccountBalance(tokenAta)).value.uiAmount
            const minVal = Math.floor(balance! / distNum / 2)
            const maxVal = Math.floor(balance! * 2 / distNum)
            let numTokenArray = generateDistribution(balance! * (1 - remaining_token_percent / 100), minVal, maxVal, distNum, "odd")
            // const tokenHoldingPercents = readTokenHoldingPercents()
            // let percentTokenArray = tokenHoldingPercents.slice(i * (distNum + 1), (i + 1) * (distNum + 1) - 1)
            // let tokenNumArray = percentTokenArray.map((percent: number) => percent / 100 * tokens[0].uiAmount)
            // BotSendMessage(`Holder percentTokenArray: ${percentTokenArray}`)
    
            const subHolderWallets = holderWallets.slice(distNum * i, distNum * (i + 1))
            const holderSks = subHolderWallets.map((privateKey: string) => Keypair.fromSecretKey(bs58.decode(privateKey)))
            await newSendToken(holderSks, numTokenArray, kp, baseMint, data.poolKeys.baseDecimals, i)
            // BotSendMessage(`Successfully transferred tokens from bundler ${i}`)
        }

        await sleep(10000)
        tokenHoldersWaiting()
    } catch (error) {
        console.log("Failed to transfer the tokens to holder wallets.", error)
        tokenHoldersWaiting()
    }
}