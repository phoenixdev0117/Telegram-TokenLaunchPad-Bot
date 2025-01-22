import { ComputeBudgetProgram, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import {   outputBalance, readBundlerWallets, readJson, saveBundlerWalletsToFile, sleep, solGatherWaiting } from "../src/utils";
import { cluster, connection } from "../config";
import { Bundler_provider_wallet_keypair, bundlerWalletName, bundleWalletNum } from "../settings"
import bs58 from 'bs58'
import { screen_clear } from "../menu/menu";
import { execute } from "../src/legacy";
import { createCloseAccountInstruction, getAssociatedTokenAddress, NATIVE_MINT } from "@solana/spl-token";
import { BotSendMessage } from "..";

const walletNum = bundleWalletNum

export const sol_gather = async () => {
    screen_clear()
    BotSendMessage(`Gathering Sol from ${bundleWalletNum} bundler wallets...`);

    const savedWallets = readBundlerWallets(bundlerWalletName)
    // console.log("🚀 ~ savedWallets: ", savedWallets)

    const walletKPs = savedWallets.map((wallet: string) => Keypair.fromSecretKey(bs58.decode(wallet)));
    const batchLength = 3
    const batchNum = Math.ceil(bundleWalletNum / batchLength)
    let successNum = 0

    try {
        for (let i = 0; i < batchNum; i++) {
            const sendSolTx: TransactionInstruction[] = []
            sendSolTx.push(
                ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
                ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 750_000 })
            )
            for (let j = 0; j < batchLength; j++) {
                let solAmount = await connection.getBalance(walletKPs[i * batchLength + j].publicKey)
                let wsolAmount = 0
                // const baseAta = await getAssociatedTokenAddress(mint, walletKPs[i * batchLength + j].publicKey)
                const quoteAta = await getAssociatedTokenAddress(NATIVE_MINT, walletKPs[i * batchLength + j].publicKey)
                if ((i * batchLength + j) >= bundleWalletNum) continue;
                if (await connection.getAccountInfo(quoteAta)){
                    // wsolAmount = (await connection.getTokenAccountBalance(quoteAta)).value.uiAmount!
                    sendSolTx.push(
                        createCloseAccountInstruction(
                            quoteAta,
                            walletKPs[i * batchLength + j].publicKey,
                            walletKPs[i * batchLength + j].publicKey
                        )
                    )
                }
                sendSolTx.push(
                    // createCloseAccountInstruction(
                    //     baseAta,
                    //     walletKPs[i * batchLength + j].publicKey,
                    //     walletKPs[i * batchLength + j].publicKey
                    // ),
                    SystemProgram.transfer({
                        fromPubkey: walletKPs[i * batchLength + j].publicKey,
                        toPubkey: Bundler_provider_wallet_keypair.publicKey,
                        lamports: Math.floor(solAmount + (wsolAmount) * LAMPORTS_PER_SOL)
                        // lamports: Math.floor(solAmount + (wsolAmount - 0.001) * LAMPORTS_PER_SOL)
                    })
                )
            }
            let index = 0
            while (true) {
                try {
                    if (index > 3) {
                        BotSendMessage("Error in gathering sol. Please retry gathering.")
                        solGatherWaiting()
                        return
                    }
                    const siTx = new Transaction().add(...sendSolTx)
                    const latestBlockhash = await connection.getLatestBlockhash()
                    siTx.feePayer = Bundler_provider_wallet_keypair.publicKey
                    siTx.recentBlockhash = latestBlockhash.blockhash
                    const messageV0 = new TransactionMessage({
                        payerKey: Bundler_provider_wallet_keypair.publicKey,
                        recentBlockhash: latestBlockhash.blockhash,
                        instructions: sendSolTx,
                    }).compileToV0Message()
                    const transaction = new VersionedTransaction(messageV0)
                    const signers = walletKPs.slice(i * batchLength, bundleWalletNum > (i + 1) * batchLength ? (i + 1) * batchLength : bundleWalletNum)
                    transaction.sign(signers)
                    transaction.sign([Bundler_provider_wallet_keypair])
                    // console.log(await connection.simulateTransaction(transaction))
                    const txSig = await execute(transaction, latestBlockhash, 1)
                    const tokenBuyTx = txSig ? `https://solscan.io/tx/${txSig}${cluster == "devnet" ? "?cluster=devnet" : ""}` : ''
                    if (txSig) {
                        successNum++
                        BotSendMessage(`SOL gathered from bundler ${batchLength * i + 1}, ${batchLength * i + 2}, ${batchLength * i + 3}: ${tokenBuyTx}`)
                    }
                    break
                } catch (error) {
                    index++
                    console.log(error)
                }
            }
        }
        console.log(`Number of successful gathering: ${successNum}`)
        if (successNum == batchNum) BotSendMessage("Successfully gathered sol from bundler wallets!")
    } catch (error) {
        BotSendMessage(`Failed to transfer SOL ${error}`)
    }
    await outputBalance(Bundler_provider_wallet_keypair.publicKey)
    solGatherWaiting()
}
