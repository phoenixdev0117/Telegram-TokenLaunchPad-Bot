import { PublicKey } from "@solana/web3.js"
import { LP_wallet_keypair, tokens } from "../settings"
import { createMarket } from "../src/createMarket"
import {   outputBalance, readJson, retrieveEnvVariable, saveDataToFile, sleep, tokenLaunchWaiting } from "../src/utils"
import { PoolInfo, UserToken } from '../src/types'
import {
  getWalletTokenAccount,
} from "../src/get_balance";
import { BotSendMessage } from ".."

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>

const execute = async (token: UserToken) => {
  let params: PoolInfo
  try {
    const data = readJson()
    if (!data.mainKp) {
      BotSendMessage("Main keypair is not set")
      return
    }
    params = {
      mint: data.mint ? new PublicKey(data.mint) : null,
      marketId: data.marketId ? new PublicKey(data.marketId) : null,
      poolId: data.poolId ? new PublicKey(data.poolId) : null,
      mainKp: data.mainKp,
      poolKeys: null,
      removed: data.removed
    }

    await outputBalance(LP_wallet_keypair.publicKey)

    // create market
    BotSendMessage("\n***************************************************************\n")
    let marketCreationFailed = 0
    while (true) {
      if (params.marketId) {
        BotSendMessage(`Market id already created before, ${params.marketId.toBase58()}`)
        break
      }
      if (marketCreationFailed > 5) {
        BotSendMessage("Market creation is failed in repetition, Terminate the process")
        return
      }
      const marketId = await createMarket(LP_wallet_keypair, params.mint!)
      if (!marketId) {
        BotSendMessage("Market creation error")
        marketCreationFailed++
      } else {
        params.marketId = marketId
        await outputBalance(LP_wallet_keypair.publicKey)
        saveDataToFile(params)
        break
      }
    }
    await sleep(3000)
  } catch (error) {
    BotSendMessage(`Error happened in one of the token flow, ${error}`)
    await sleep(3000)
  }
}

export const create_market = async () => {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    BotSendMessage(`Market ${i + 1} is to be created`)
    await execute(token)
    BotSendMessage("One Market process is ended, and go for next one")
    tokenLaunchWaiting()
  }
}
