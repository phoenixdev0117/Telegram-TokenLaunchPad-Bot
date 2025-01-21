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
import {   mainMenuWaiting, readBundlerWallets, readHolderWallets, readJson, sleep, tokenHoldersWaiting } from "../src/utils";
import { sendAndConfirmTransaction } from "@solana/web3.js";
import { rl } from "../menu/menu";
import { BotSendMessage, bot } from "..";

const mainKp = LP_wallet_keypair
const mainPk = mainKp.publicKey

export const holder_gather_some = async () => {
    try {
        const bundlerWallets: string[] = readBundlerWallets(bundlerWalletName)
        const holderWallets = readHolderWallets(holderWalletName)
        const data = readJson()
        const baseMint = new PublicKey(data.mint!)

        BotSendMessage(`\t[Bundlers] - Bundler wallets to gather tokens (if you want to go back, press c and press enter): `)
        
        bot.on("message", async (msg) => {
            var _a;
            const chatId = msg.chat.id;
            const USER_ID = chatId;
            const userID = msg.from?.id;
            const answer: string | undefined = msg.text ?? '';
        // rl.question("\t[Bundlers] - Bundler wallets to gather tokens (if you want to go back, press c and press enter): ", async (answer: string) => {

            if (answer == 'c') mainMenuWaiting()

            const numberStrings = answer.split(/\s+/); // This regex handles multiple spaces between numbers
            const numbers = numberStrings.map(numStr => Number(numStr)).filter(num => !isNaN(num));
            const selectedBundlerWallets = numbers.map(index => bundlerWallets[index - 1]);

            selectedBundlerWallets.map(async (bundler: string, i) => {
                const kp = Keypair.fromSecretKey(bs58.decode(bundler))
                const tokenAta = getAssociatedTokenAddressSync(baseMint, kp.publicKey)
                const balance = (await connection.getTokenAccountBalance(tokenAta)).value.uiAmount

                BotSendMessage(`Balance of bundler ${numbers[i]}: ${balance}`)

                const subHolderWallets = holderWallets.slice(distNum * (numbers[i] - 1), distNum * numbers[i])
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
                        let index = k * batchSize + j
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
                    if (sig) {
                        BotSendMessage(`Success gather to bundler ${numbers[i]}: https://solscan.io/tx/${sig}${cluster == "devnet" ? "?cluster=devnet" : ""}`)
                    }

                }

            })
            await sleep(20000)
            tokenHoldersWaiting()
        })

    } catch (error) {
        console.log("Error in gather token to bundler: ", error)
        tokenHoldersWaiting()
    }

}