import { ComputeBudgetProgram, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import {   mainMenuWaiting, outputBalance, prepareBundleWaiting, readBundlerWallets, readSwapAmounts, saveBundlerWalletsToFile, saveSwapSolAmountToFile, sleep } from "../src/utils";
import { cluster, connection } from "../config";
import { Bundler_provider_wallet_keypair, bundlerWalletName, bundleWalletNum, extra_sol_amount, LP_wallet_keypair } from "../settings"
import bs58 from 'bs58'
import { screen_clear } from "../menu/menu";
import { execute } from "../src/legacy";
import { BotSendMessage } from "..";

const walletNum = bundleWalletNum

export const wallet_create = async () => {
  screen_clear()
  BotSendMessage(`Creating ${walletNum} Wallets for bundle buy`);
  let bundlerProviderBal = await outputBalance(Bundler_provider_wallet_keypair.publicKey)

  let wallets: string[] = []
  let solAmountArray = readSwapAmounts()
  let totalSolRequired = 0
  for (let j = 0; j < bundleWalletNum; j++) {
    totalSolRequired += solAmountArray[j]
  }
  
  if(bundlerProviderBal < totalSolRequired) {
    BotSendMessage(`Total required Sol is ${totalSolRequired}sol, but bundler provider wallet has ${bundlerProviderBal}, please deposit more and retry.`)
    prepareBundleWaiting()
    return
  }

  // Step 1 - creating bundler wallets
  try {
    for (let i = 0; i < bundleWalletNum; i++) {
      const newWallet = Keypair.generate()
      wallets.push(bs58.encode(newWallet.secretKey))
      BotSendMessage(`Bundler ${i + 1} => ${newWallet.publicKey.toBase58()}`)
    }
    saveBundlerWalletsToFile(
      wallets, bundlerWalletName
    )
    await sleep(2000)
  } catch (error) { console.log(error) }

  const savedWallets = readBundlerWallets(bundlerWalletName)
  // console.log("🚀 ~ savedWallets: ", savedWallets)

  // Step 2 - distributing sol to bundler wallets
  BotSendMessage("Distributing sol to bundler wallets...")

  const walletKPs = savedWallets.map((wallet: string) => Keypair.fromSecretKey(bs58.decode(wallet)));
  const batchLength = 15
  const batchNum = Math.ceil(bundleWalletNum / batchLength)
  const swapSolAmount = readSwapAmounts()

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
            lamports: Math.floor((swapSolAmount[i * batchLength + j] + extra_sol_amount) * LAMPORTS_PER_SOL)
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
          console.log(await connection.simulateTransaction(transaction))
          const txSig = await execute(transaction, latestBlockhash, 1)
          const tokenBuyTx = txSig ? `https://solscan.io/tx/${txSig}${cluster == "devnet" ? "?cluster=devnet" : ""}` : ''
          BotSendMessage(`SOL distributed ${tokenBuyTx}`)
          break
        } catch (error) {
          index++
        }
      }
    }
    outputBalance(Bundler_provider_wallet_keypair.publicKey)
    outputBalance(LP_wallet_keypair.publicKey)
    BotSendMessage("Successfully distributed sol to bundler wallets!")
  } catch (error) {
    console.log(`Failed to transfer SOL`, error)
  }
  await sleep(5000)
  prepareBundleWaiting()
}
