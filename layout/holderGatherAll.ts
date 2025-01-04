import { cluster, connection } from "../config"
import bs58 from "bs58"
import {
    ComputeBudgetProgram,
    Keypair,
    PublicKey,
    Transaction,
} from "@solana/web3.js"
import {
    createTransferCheckedInstruction,
    getAssociatedTokenAddressSync
} from "@solana/spl-token";
import { bundlerWalletName, distNum, holderWalletName, LP_wallet_keypair } from "../settings";
import {   readBundlerWallets, readHolderWallets, readJson, sleep, tokenHoldersWaiting } from "../src/utils";
import { sendAndConfirmTransaction } from "@solana/web3.js";
import { BotSendMessage } from "..";

const mainKp = LP_wallet_keypair
const mainPk = mainKp.publicKey

export const holder_gather_all = async () => {
    try {
        const bundlerWallets: string[] = readBundlerWallets(bundlerWalletName)
        const holderWallets = readHolderWallets(holderWalletName)
        const data = readJson()
        const baseMint = new PublicKey(data.mint!)

        bundlerWallets.map(async (bundler: string, i) => {
            const kp = Keypair.fromSecretKey(bs58.decode(bundler))
            const tokenAta = getAssociatedTokenAddressSync(baseMint, kp.publicKey)
            const balance = (await connection.getTokenAccountBalance(tokenAta)).value.uiAmount

            BotSendMessage(`Balance of bundler ${i + 1}: ${balance}`)

            const subHolderWallets = holderWallets.slice(distNum * i, distNum * (i + 1))
            const holderKps = subHolderWallets.map((privateKey: string) => Keypair.fromSecretKey(bs58.decode(privateKey)))

            let batchSize = 5
            let batchNum = Math.ceil(distNum / batchSize)

            for (let k = 0; k < batchNum; k++) {
                const signers = holderKps.slice(k * batchSize, (k + 1) * batchSize > distNum ? distNum : (k + 1) * batchSize)
                const tx = new Transaction().add(
                    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
                    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000_000 })
                )
                for (let j = 0; j < batchSize; j++) {
                    if ((k * batchSize + j) == distNum) break;
                    let index = (k * batchSize + j)
                    const srcAta = getAssociatedTokenAddressSync(baseMint, holderKps[index].publicKey)
                    const amount = (await connection.getTokenAccountBalance(srcAta)).value.amount
                    const tokenDecimal = (await connection.getTokenAccountBalance(srcAta)).value.decimals

                    tx.add(
                        createTransferCheckedInstruction(
                            srcAta,
                            baseMint,
                            tokenAta,
                            holderKps[index].publicKey,
                            Math.floor(Number(amount)),
                            tokenDecimal
                        )
                    )
                }
                tx.feePayer = kp.publicKey
                // console.log(await connection.simulateTransaction(tx))
                const sig = await sendAndConfirmTransaction(connection, tx, [kp, ...signers])
                if (sig) BotSendMessage(`Success gather to bundler ${i + 1}: https://solscan.io/tx/${sig}${cluster == "devnet" ? "?cluster=devnet" : ""}`)
            }
        })

        await sleep(20000)
        tokenHoldersWaiting()
    } catch (error) {
        tokenHoldersWaiting()
        console.log("Error in gather token to bundler: ", error)
    }

}