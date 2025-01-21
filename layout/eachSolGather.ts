import { ComputeBudgetProgram, Keypair, LAMPORTS_PER_SOL, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import {   outputBalance, readBundlerWallets, sleep, solGatherWaiting } from "../src/utils";
import { cluster, connection } from "../config";
import { Bundler_provider_wallet_keypair, bundlerWalletName, bundleWalletNum } from "../settings"
import bs58 from 'bs58'
import { rl, screen_clear } from "../menu/menu";
import { execute } from "../src/legacy";
import { createAssociatedTokenAccountInstruction, createTransferCheckedInstruction, getAssociatedTokenAddress, NATIVE_MINT } from "@solana/spl-token";
import { BotSendMessage, bot } from "..";

const walletNum = bundleWalletNum

export const each_sol_gather = async () => {
    screen_clear()
    BotSendMessage(`Gathering Wsol from one of bundler wallets...`);

    const savedWallets = readBundlerWallets(bundlerWalletName)
    // console.log("🚀 ~ savedWallets: ", savedWallets)

    const walletKPs = savedWallets.map((wallet: string) => Keypair.fromSecretKey(bs58.decode(wallet)));
    BotSendMessage(`\t[Bundler] - Bundler wallet to gather wsol (if you want to go back, press c and press enter): `);
    bot.on("message", async (msg) => {
        var _a;
        const chatId = msg.chat.id;
        const USER_ID = chatId;
        const userID = msg.from?.id;
        const answer: string | undefined = msg.text ?? '';
    // rl.question("\t[Bundler] - Bundler wallet to gather wsol (if you want to go back, press c and press enter): ", async (answer: string) => {
        if (answer == 'c') {
            solGatherWaiting()
            return
        }

        const walletIndex = parseInt(answer)
        let solBalance = await connection.getBalance(walletKPs[walletIndex - 1].publicKey)
        const quoteAta = await getAssociatedTokenAddress(NATIVE_MINT, walletKPs[walletIndex - 1].publicKey)
        const mainAta = await getAssociatedTokenAddress(NATIVE_MINT, Bundler_provider_wallet_keypair.publicKey)
        let wsolBalance = await (await connection.getTokenAccountBalance(quoteAta)).value.uiAmount
        BotSendMessage(`Balance of the wallet${walletIndex} SOL : ${solBalance / LAMPORTS_PER_SOL}sol, WSOL : ${wsolBalance}wsol`)
        BotSendMessage(`\t[Wsol Amount] - Please input the amount of wsol to gather (if you want to go back, press c and press enter): `)

        bot.on("message", async (msg) => {
            var _a;
            const chatId = msg.chat.id;
            const USER_ID = chatId;
            const userID = msg.from?.id;
            const answer: string | undefined = msg.text ?? '';
            
        // rl.question("\t[Wsol Amount] - Please input the amount of wsol to gather (if you want to go back, press c and press enter): ", async (answer: string) => {
            if (answer == 'c') {
                solGatherWaiting()
                return
            }
            const wsolAmount = parseFloat(answer)
            const sendWsolTx: TransactionInstruction[] = []
            sendWsolTx.push(
                ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
                ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 750_000 })
            )
            if (!await connection.getAccountInfo(mainAta)) {
                sendWsolTx.push(
                    createAssociatedTokenAccountInstruction(
                        Bundler_provider_wallet_keypair.publicKey,
                        mainAta,
                        Bundler_provider_wallet_keypair.publicKey,
                        NATIVE_MINT
                    )
                )
            }
            sendWsolTx.push(
                createTransferCheckedInstruction(
                    quoteAta,
                    NATIVE_MINT,
                    mainAta,
                    walletKPs[walletIndex - 1].publicKey,
                    Math.floor(wsolAmount * 10 ** 9),
                    9
                )
            )
            let index = 0
            while (true) {
                try {
                    if (index > 3) {
                        BotSendMessage("Error in gathering wsol. Please retry gathering.")
                        solGatherWaiting()
                        return
                    }
                    const siTx = new Transaction().add(...sendWsolTx)
                    const latestBlockhash = await connection.getLatestBlockhash()
                    siTx.feePayer = Bundler_provider_wallet_keypair.publicKey
                    siTx.recentBlockhash = latestBlockhash.blockhash
                    const messageV0 = new TransactionMessage({
                        payerKey: Bundler_provider_wallet_keypair.publicKey,
                        recentBlockhash: latestBlockhash.blockhash,
                        instructions: sendWsolTx,
                    }).compileToV0Message()
                    const transaction = new VersionedTransaction(messageV0)
                    const signers = [walletKPs[walletIndex - 1]]
                    transaction.sign(signers)
                    transaction.sign([Bundler_provider_wallet_keypair])
                    console.log(await connection.simulateTransaction(transaction))
                    const txSig = await execute(transaction, latestBlockhash, 1)
                    const tokenBuyTx = txSig ? `https://solscan.io/tx/${txSig}${cluster == "devnet" ? "?cluster=devnet" : ""}` : ''
                    if (txSig) {
                        BotSendMessage(`WSOL gathered from bundler ${walletIndex}: ${tokenBuyTx}`)
                    }
                    break
                } catch (error) {
                    index++
                    console.log(error)
                }
            }
            await sleep(5000)
            await outputBalance(Bundler_provider_wallet_keypair.publicKey)
            solGatherWaiting()
        })
    })

}
