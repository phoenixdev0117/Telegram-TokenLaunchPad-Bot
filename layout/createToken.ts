import { LP_wallet_keypair, LP_wallet_private_key, tokens } from "../settings"
import { createTokenWithMetadata } from "../src/createTokenPinata"
import {   mainMenuWaiting, outputBalance, saveDataToFile, sleep, tokenLaunchWaiting } from "../src/utils"
import { PoolInfo, UserToken } from '../src/types'
import {
  getWalletTokenAccount,
} from "../src/get_balance";
import { BotSendMessage } from "..";

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>

const execute = async (token: UserToken) => {
  let params: PoolInfo
  try {
      params = {
        mint: null,
        marketId: null,
        poolId: null,
        mainKp: LP_wallet_private_key,
        poolKeys: null,
        removed: false
      }

    await outputBalance(LP_wallet_keypair.publicKey)

    // create token
    BotSendMessage("\n***************************************************************\n")
    let tokenCreationFailed = 0
    while (true) {
      if (tokenCreationFailed > 5) {
        BotSendMessage("Token creation is failed in repetition, Terminate the process")
        return
      }
      const mintResult = await createTokenWithMetadata(token)
      if (!mintResult) {
        BotSendMessage("Token creation error, trying again")
        tokenCreationFailed++
      } else {
        const { amount, mint } = mintResult
        params.mint = mint
        await outputBalance(LP_wallet_keypair.publicKey)
        await sleep(5000)
        saveDataToFile(params)
        break
      }
    }

  } catch (error) {
    BotSendMessage(`Error happened in one of the token flow ${error}`)
  }
}

export const create_token = async () => {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    BotSendMessage(`Token is to be created`)
    await execute(token)
    await sleep(5000)
    BotSendMessage("One token creating process is ended, and go for next step")
    tokenLaunchWaiting()
  }
}
