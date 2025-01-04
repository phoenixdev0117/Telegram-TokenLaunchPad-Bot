import bs58 from "bs58"
import { ComputeBudgetProgram, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SignatureStatus, SystemProgram, Transaction, TransactionConfirmationStatus, TransactionInstruction, TransactionMessage, TransactionSignature, VersionedTransaction } from "@solana/web3.js"
import { cluster, connection } from "../config";
import {   mainMenuWaiting, outputBalance, prepareBundleWaiting, readBundlerWallets, readJson, readSwapAmounts, sleep } from "../src/utils";
import { Bundler_provider_wallet_keypair, bundlerWalletName } from "../settings";
import { createAssociatedTokenAccountIdempotentInstruction, createSyncNativeInstruction, getAssociatedTokenAddress, NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BotSendMessage } from "..";

const data = readJson()
const SIGNER_WALLET = Bundler_provider_wallet_keypair

const createAtas = async (wallets: Keypair[], baseMint: PublicKey) => {

    const swapSolAmount = readSwapAmounts()

    try {
        let successTxNum = 0
        wallets.map((async (wallet, i) => {
            await sleep(1000 * i)
            const quoteAta = await getAssociatedTokenAddress(NATIVE_MINT, wallet.publicKey)
            const baseAta = await getAssociatedTokenAddress(baseMint, wallet.publicKey)

            const tx = new Transaction().add(
                ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 744_452 }),
                ComputeBudgetProgram.setComputeUnitLimit({ units: 1_183_504 }),
                createAssociatedTokenAccountIdempotentInstruction(
                    wallet.publicKey,
                    quoteAta,
                    wallet.publicKey,
                    NATIVE_MINT,
                ),
                createAssociatedTokenAccountIdempotentInstruction(
                    wallet.publicKey,
                    baseAta,
                    wallet.publicKey,
                    baseMint,
                ),
                SystemProgram.transfer({
                    fromPubkey: wallet.publicKey,
                    toPubkey: quoteAta,
                    lamports: Math.floor(swapSolAmount[i] * LAMPORTS_PER_SOL)
                }),
                createSyncNativeInstruction(quoteAta, TOKEN_PROGRAM_ID),
            )
            const blockhash = (await connection.getLatestBlockhash())
            tx.feePayer = wallet.publicKey
            tx.recentBlockhash = blockhash.blockhash
            const sig = await connection.sendTransaction(tx, [wallet])
            // const sig = await sendAndConfirmTransaction(connection, tx, [wallet])
            const confirmation = await connection.confirmTransaction({
                signature: sig,
                blockhash: blockhash.blockhash,
                lastValidBlockHeight: blockhash.lastValidBlockHeight,
            })
            if (confirmation.value.err) {
                const blockhash = await connection.getLatestBlockhash()
                const sig = await connection.sendTransaction(tx, [wallet])
                const confirmation = await connection.confirmTransaction({
                    signature: sig,
                    blockhash: blockhash.blockhash,
                    lastValidBlockHeight: blockhash.lastValidBlockHeight,
                })
                if (confirmation.value.err) {
                    console.log("Error in create atas")
                    return
                } else {
                    successTxNum++
                    if (successTxNum === wallets.length) {
                        console.log("Ata creation finished")
                        return
                    }
                }
            } else {
                successTxNum++
                BotSendMessage(`Wallet${i + 1}'s ata preparation tx: https://solscan.io/tx/${sig}${cluster == "devnet" ? "?cluster=devnet" : ""}`)
                if (successTxNum === wallets.length) {
                    BotSendMessage("Ata creation finished")
                    return
                }
            }
        }))
        BotSendMessage("Waiting for ata creation result")
        await sleep(35000)
        BotSendMessage(`Successful ata creation for ${successTxNum} wallets`)
        // if (successTxNum === wallets.length) {
            BotSendMessage("Ata creation finished")
            // return
        // } else {
            // BotSendMessage(`${wallets.length - successTxNum} tx failed, try again`)
        // }
    } catch (error) {
        console.log("Prepare Ata creation error:", error)
        return
    }
}

export const create_atas = async () => {

    const wallets = readBundlerWallets(bundlerWalletName)
    const walletKPs = wallets.map((wallet: string) => Keypair.fromSecretKey(bs58.decode(wallet)));
    const data = readJson()
    const mint = new PublicKey(data.mint!)

    try {
        await outputBalance(SIGNER_WALLET.publicKey)

        BotSendMessage("Creating associated token accounts.")
        await createAtas(walletKPs, mint)

        await outputBalance(SIGNER_WALLET.publicKey)
        prepareBundleWaiting()
    } catch (err) {
        BotSendMessage("Error occurred in creating lookuptable. Please retry this again.")
        prepareBundleWaiting()
    }

}