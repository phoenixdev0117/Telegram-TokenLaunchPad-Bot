import { ComputeBudgetProgram, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import {   mainMenuWaiting, readBundlerWallets } from "../src/utils";
import { cluster, connection } from "../config";
import { Bundler_provider_wallet_keypair, bundlerWalletName, bundleWalletNum } from "../settings"
import bs58 from 'bs58'
import { rl, screen_clear } from "../menu/menu";
import { execute } from "../src/legacy";
import { BotSendMessage, bot } from "..";

const walletNum = bundleWalletNum

export const sol_distribute = async () => {
  screen_clear()
  BotSendMessage(`Distributing sol to ${walletNum} Wallets for bundle buy`);

  const savedWallets = readBundlerWallets(bundlerWalletName)
  // console.log("🚀 ~ savedWallets: ", savedWallets)

  // Step 2 - distributing sol to bundler wallets
  BotSendMessage("Distributing sol to bundler wallets...")
  
  const walletKPs = savedWallets.map((wallet: string) => Keypair.fromSecretKey(bs58.decode(wallet)));
  const batchLength = 15
  const batchNum = Math.ceil(bundleWalletNum / batchLength)
  
  BotSendMessage("\t[Amount of Sol to distribute] - Sol Amount (if you want to go back, press c and press enter): ")
  // rl.question("\t[Amount of Sol to distribute] - Sol Amount (if you want to go back, press c and press enter): ", async (answer: string) => {
  bot.on("message", async (msg) => {
      var _a;
      const chatId = msg.chat.id;
      const USER_ID = chatId;
      const userID = msg.from?.id;
      const answer: string | undefined = msg.text ?? '';
    if (answer == 'c') mainMenuWaiting()

    const solAmount = parseFloat(answer)

    try {
      for (let i = 0; i < batchNum; i++) {
        const sendSolTx: TransactionInstruction[] = []
        sendSolTx.push(
          ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 550_000 })
        )
        for (let j = 0; j < batchLength; j++) {
  
          if ((i * batchLength + j) >= bundleWalletNum) continue;
          sendSolTx.push(
            SystemProgram.transfer({
              fromPubkey: Bundler_provider_wallet_keypair.publicKey,
              toPubkey: walletKPs[i * batchLength + j].publicKey,
              lamports: Math.floor((solAmount) * LAMPORTS_PER_SOL)
            })
          )
        }
        let index = 0
        while (true) {
          try {
            if (index > 3) {
              BotSendMessage("Error in distribution")
              return null
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
            transaction.sign([Bundler_provider_wallet_keypair])
            const txSig = await execute(transaction, latestBlockhash, 1)
            const tokenBuyTx = txSig ? `https://solscan.io/tx/${txSig}${cluster == "devnet" ? "?cluster=devnet" : ""}` : ''
            BotSendMessage(`SOL distributed ${tokenBuyTx}`)
            break
          } catch (error) {
            index++
          }
        }
      }
      BotSendMessage("Successfully distributed sol to bundler wallets!")
    } catch (error) {
      BotSendMessage(`Failed to transfer SOL ${error}`)
    }
  
    mainMenuWaiting()
  })

}
