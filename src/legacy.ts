import { VersionedTransaction } from "@solana/web3.js";
import { connection } from "../config";
import { logToFile } from "./utils";
import { BotSendMessage } from "..";


interface Blockhash {
  blockhash: string;
  lastValidBlockHeight: number;
}

export const execute = async (transaction: VersionedTransaction, latestBlockhash: Blockhash, isBuy: boolean | 1 = true) => {

  const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: true })
  const confirmation = await connection.confirmTransaction(
    {
      signature,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      blockhash: latestBlockhash.blockhash,
    }
  );

  if (confirmation.value.err) {
    BotSendMessage("Confirmation error")
    return ""
  } else {
    if(isBuy === 1){
      return signature
    } else if (isBuy)
      BotSendMessage(`Success in buy transaction: https://solscan.io/tx/${signature}`)
    else
      BotSendMessage(`Success in Sell transaction: https://solscan.io/tx/${signature}`)
  }
  return signature
}
