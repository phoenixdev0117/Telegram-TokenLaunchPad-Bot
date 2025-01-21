import { Keypair } from "@solana/web3.js";
import {   saveBundlerWalletsToFile, tokenLaunchWaiting } from "../src/utils";
import { bundleWalletNum, distNum, distWalletNum, holderWalletName } from "../settings"
import { screen_clear } from "../menu/menu";
import base58 from "bs58";
import { BotSendMessage } from "..";

export const holder_create = async () => {
  screen_clear()
  BotSendMessage("creating holder wallets")

  const distWallets = []
  try {
    for (let i = 0; i < distWalletNum; i++) {
      const kp = Keypair.generate()
      distWallets.push(base58.encode(kp.secretKey))
    }
    saveBundlerWalletsToFile(
      distWallets, holderWalletName
    )
    for (let i = 0; i < bundleWalletNum; i++) {
      BotSendMessage(`Bundler ${i + 1} => `)
      for(let j = 0; j < distNum; j++) {
        BotSendMessage(`  Holder ${j + 1}: ${distWallets[i * distNum + j]}`)
      }
    }
  } catch (err) { }

  tokenLaunchWaiting()
}
