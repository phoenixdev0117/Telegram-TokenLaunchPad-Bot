import dotenv from 'dotenv'
import fs from 'fs'
import readline from 'readline'
import { Connection, GetProgramAccountsFilter, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { connection } from "../config";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SPL_ACCOUNT_LAYOUT, TokenAccount } from "@raydium-io/raydium-sdk";
import base58 from "bs58";
import { PoolInfo, PoolInfoStr, TokenInfo } from "./types";
import { balances, BotSendMessage, gather, init, prepare_bundle, security_checks, sell_buy, token_holders, token_launch } from '..'
import { rl } from '../menu/menu';
import path from 'path';
import { Bundler_provider_private_key, Bundler_provider_wallet_keypair, LP_wallet_keypair } from '../settings';

// dotenv.config()
const today: string = new Date().toISOString().split('T')[0];

// Define the path for the 'logs' folder
const logsFolderPath: string = path.join(__dirname, 'logs');

// Check if the 'logs' folder exists; if not, create it
if (!fs.existsSync(logsFolderPath)) {
  fs.mkdirSync(logsFolderPath);
}

// Define the log file name as the current date (e.g., '2024-11-26.txt')
const logFileName: string = `${today}.txt`;
const logFilePath: string = path.join(logsFolderPath, logFileName);

// Function to append logs to the log file
export function logToFile(message: string): void {
  const timestamp: string = new Date().toISOString();
  const logMessage: string = `[${timestamp}] ${message}\n`;

  console.log(message)

  // Append the message to the log file
  fs.appendFile(logFilePath, logMessage, (err: NodeJS.ErrnoException | null) => {
    if (err) {
      console.error('Failed to write log:', err);
    }
  });
}

export const retrieveEnvVariable = (variableName: string) => {
  const variable = process.env[variableName] || ''
  if (!variable) {
    console.log(`${variableName} is not set`)
    process.exit(1)
  }
  return variable
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function calcNonDecimalValue(value: number, decimals: number): number {
  return Math.trunc(value * (Math.pow(10, decimals)))
}

export function calcDecimalValue(value: number, decimals: number): number {
  return value / (Math.pow(10, decimals))
}

export async function getNullableResultFromPromise<T>(value: Promise<T>, opt?: { or?: T, logError?: boolean }): Promise<T | null> {
  return value.catch((error) => {
    if (opt) console.log({ error })
    return opt?.or != undefined ? opt.or : null
  })
}

// Define the type for the JSON file content
export interface Data {
  privateKey: string;
  pubkey: string;
}


/**
 *   
 * For Market Creation
 * 
 */

export const EVENT_QUEUE_LENGTH = 2978;
export const EVENT_SIZE = 88;
export const EVENT_QUEUE_HEADER_SIZE = 32;

export const REQUEST_QUEUE_LENGTH = 63;
export const REQUEST_SIZE = 80;
export const REQUEST_QUEUE_HEADER_SIZE = 32;

export const ORDERBOOK_LENGTH = 909;
export const ORDERBOOK_NODE_SIZE = 72;
export const ORDERBOOK_HEADER_SIZE = 40;

// export async function getVaultOwnerAndNonce(
//   marketAddress: PublicKey,
//   dexAddress: PublicKey
// ): Promise<[vaultOwner: PublicKey, nonce: BN]> {
//   const nonce = new BN(0);
//   // eslint-disable-next-line no-constant-condition
//   while (true) {
//     try {
//       const vaultOwner = await PublicKey.createProgramAddress(
//         [marketAddress.toBuffer(), nonce.toArrayLike(Buffer, "le", 8)],
//         dexAddress
//       );
//       return [vaultOwner, nonce];
//     } catch (e) {
//       nonce.iaddn(1);
//     }
//   }
// }

export function calculateTotalAccountSize(
  individualAccountSize: number,
  accountHeaderSize: number,
  length: number
) {
  const accountPadding = 12;
  const minRequiredSize =
    accountPadding + accountHeaderSize + length * individualAccountSize;

  const modulo = minRequiredSize % 8;

  return modulo <= 4
    ? minRequiredSize + (4 - modulo)
    : minRequiredSize + (8 - modulo + 4);
}

export function calculateAccountLength(
  totalAccountSize: number,
  accountHeaderSize: number,
  individualAccountSize: number
) {
  const accountPadding = 12;
  return Math.floor(
    (totalAccountSize - accountPadding - accountHeaderSize) /
    individualAccountSize
  );
}

export const outputBalance = async (solAddress: PublicKey) => {
  const bal = await connection.getBalance(solAddress, "processed") / LAMPORTS_PER_SOL
  switch (solAddress.toBase58()) {
    case LP_wallet_keypair.publicKey.toBase58() :
      BotSendMessage(`Balance in dev wallet ${solAddress.toBase58()} is ${bal}SOL`)
      break;
    case Bundler_provider_wallet_keypair.publicKey.toBase58() :
      BotSendMessage(`Balance in bundler provider wallet ${solAddress.toBase58()} is ${bal}SOL`)
      break;
    default :
      BotSendMessage(`Balance in dev wallet ${solAddress.toBase58()} is ${bal}SOL`)
      break;
  }
  return bal
}

/**
 * 
 *  For pool creation
 * 
 */

export async function getTokenAccountBalance(
  connection: Connection,
  wallet: string,
  mint_token: string
) {
  const filters: GetProgramAccountsFilter[] = [
    {
      dataSize: 165, //size of account (bytes)
    },
    {
      memcmp: {
        offset: 32, //location of our query in the account (bytes)
        bytes: wallet, //our search criteria, a base58 encoded string
      },
    },
    //Add this search parameter
    {
      memcmp: {
        offset: 0, //number of bytes
        bytes: mint_token, //base58 encoded string
      },
    },
  ];
  const accounts = await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
    filters: filters,
  });

  for (const account of accounts) {
    const parsedAccountInfo: any = account.account.data;
    // const mintAddress: string = parsedAccountInfo["parsed"]["info"]["mint"];
    const tokenBalance: number = parseInt(
      parsedAccountInfo["parsed"]["info"]["tokenAmount"]["amount"]
    );

    // console.log(
    //   `Account: ${account.pubkey.toString()} - Mint: ${mintAddress} - Balance: ${tokenBalance}`
    // );

    if (tokenBalance) {
      return tokenBalance;
    }
  }
}

export function assert(condition: any, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg);
  }
}

export async function getWalletTokenAccount(
  connection: Connection,
  wallet: PublicKey
): Promise<TokenAccount[]> {
  const walletTokenAccount = await connection.getTokenAccountsByOwner(wallet, {
    programId: TOKEN_PROGRAM_ID,
  });
  return walletTokenAccount.value.map((i) => ({
    pubkey: i.pubkey,
    programId: i.account.owner,
    accountInfo: SPL_ACCOUNT_LAYOUT.decode(i.account.data),
  }));
}

/**
 * 
 *  Pool remove part
 * 
 */


export async function getATAAddress(
  programId: PublicKey,
  owner: PublicKey,
  mint: PublicKey
) {
  const [publicKey, nonce] = await PublicKey.findProgramAddress(
    [owner.toBuffer(), programId.toBuffer(), mint.toBuffer()],
    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
  );
  return { publicKey, nonce };
}

export function recognizeExistance(filename: string) {
  if(fs.existsSync(filename)) return true;
  else return false;
}


export function readJson(filename: string = "data.json"): PoolInfoStr {
  try {
    if (!fs.existsSync(filename)) {
      // If the file does not exist, create an empty array
      return {
        mint: null,
        marketId: null,
        poolId: null,
        mainKp: null,
        poolKeys: null,
        removed: false
      }
    }
    const data = fs.readFileSync(filename, 'utf-8');
    const parsedData = JSON.parse(data)
    return parsedData
  } catch (error) {
    return {
      mint: null,
      marketId: null,
      poolId: null,
      mainKp: null,
      poolKeys: null,
      removed: false
    }
  }
}

export function readWallets(filename: string = "wallets.json"): string[] {
  try {
    if (!fs.existsSync(filename)) {
      // If the file does not exist, create an empty array
      console.log("Wallets are not set in wallets.json file.")
      return []
    }
    const data = fs.readFileSync(filename, 'utf-8');
    const parsedData = JSON.parse(data)
    return parsedData.wallets
  } catch (error) {
    console.log(error)
    return []
  }
}

export const readBundlerWallets = (filename: string) => {
  const filePath: string = `wallets/${filename}.json`

  try {
    // Check if the file exists
    if (fs.existsSync(filePath)) {
      // Read the file content
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const wallets = JSON.parse(fileContent);
      return wallets;
    } else {
      console.log(`File ${filePath} does not exist.`);
      return [];
    }
  } catch (error) {
    console.log('Error reading data from JSON file:', error);
    return [];
  }
};

export const readHolderWallets = (filename: string) => {
  const filePath: string = `wallets/${filename}.json`

  try {
    // Check if the file exists
    if (fs.existsSync(filePath)) {
      // Read the file content
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const wallets = JSON.parse(fileContent);
      return wallets;
    } else {
      console.log(`File ${filePath} does not exist.`);
      return [];
    }
  } catch (error) {
    console.log('Error reading data from JSON file:', error);
    return [];
  }
};

export const readSwapAmounts = (filename: string = "swapAmounts") => {
  const filePath: string = `wallets/${filename}.json`

  try {
    // Check if the file exists
    if (fs.existsSync(filePath)) {
      // Read the file content
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const amounts = JSON.parse(fileContent);
      return amounts;
    } else {
      console.log(`File ${filePath} does not exist.`);
      return [];
    }
  } catch (error) {
    console.log('Error reading data from JSON file:', error);
    return [];
  }
};

export const readTokenHoldingPercents = (filename: string = "tokenHoldingPercents") => {
  const filePath: string = `wallets/${filename}.json`

  try {
    // Check if the file exists
    if (fs.existsSync(filePath)) {
      // Read the file content
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const amounts = JSON.parse(fileContent);
      return amounts;
    } else {
      console.log(`File ${filePath} does not exist.`);
      return [];
    }
  } catch (error) {
    console.log('Error reading data from JSON file:', error);
    return [];
  }
};

export const saveLUTAddressToFile = (publicKey: string, filePath: string = "wallets/lutAddress.txt") => {
  try {
    // Write the public key to the specified file
    fs.writeFileSync(filePath, publicKey);
    console.log("Public key saved successfully to", filePath);
  } catch (error) {
    console.log('Error saving public key to file:', error);
  }
};

export const readLUTAddressFromFile = (filePath: string = "wallets/lutAddress.txt") => {
  try {
    // Check if the file exists
    if (fs.existsSync(filePath)) {
      // Read the file content
      const publicKey = fs.readFileSync(filePath, 'utf-8');
      return publicKey.trim(); // Remove any surrounding whitespace or newlines
    } else {
      console.log(`File ${filePath} does not exist.`);
      return null; // Return null if the file does not exist
    }
  } catch (error) {
    console.log('Error reading public key from file:', error);
    return null; // Return null in case of error
  }
};

export const saveDataToFile = (newData: PoolInfo, filePath: string = "data.json") => {
  try {
    // let existingData: PoolInfo

    // Check if the file exists
    if (fs.existsSync(filePath)) {
      // try {
      //   // If the file exists, read its content
      //   const fileContent = fs.readFileSync(filePath, 'utf-8');
      //   existingData = JSON.parse(fileContent);
      // } catch (parseError) {
      //   // If there is an error parsing the file, delete the corrupted file
      //   console.error('Error parsing JSON file, deleting corrupted file:', parseError);
      fs.unlinkSync(filePath);
      // }
    }

    // Write the updated data back to the file
    fs.writeFileSync(filePath, JSON.stringify(newData, null, 2));

  } catch (error) {
    console.log('Error saving data to JSON file:', error);
  }
};
export const saveTokenInfoToFile = (newData: TokenInfo, filePath: string = "TokenInfo.json") => {
  try {
    // let existingData: PoolInfo

    // Check if the file exists
    if (fs.existsSync(filePath)) {
      // try {
      //   // If the file exists, read its content
      //   const fileContent = fs.readFileSync(filePath, 'utf-8');
      //   existingData = JSON.parse(fileContent);
      // } catch (parseError) {
      //   // If there is an error parsing the file, delete the corrupted file
      //   console.error('Error parsing JSON file, deleting corrupted file:', parseError);
      fs.unlinkSync(filePath);
      // }
    }

    // Write the updated data back to the file
    fs.writeFileSync(filePath, JSON.stringify(newData, null, 2));

  } catch (error) {
    console.log('Error saving data to JSON file:', error);
  }
};

export const saveVolumeWalletToFile = (newData: Data[], filePath: string = "wallets/volumeWallets.json") => {
  try {
    let existingData: Data[] = [];

    // Check if the file exists
    if (fs.existsSync(filePath)) {
      // If the file exists, read its content
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      existingData = JSON.parse(fileContent);
    }

    // Add the new data to the existing array
    existingData.push(...newData);

    // Write the updated data back to the file
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));

  } catch (error) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`File ${filePath} deleted and create new file.`);
      }
      fs.writeFileSync(filePath, JSON.stringify(newData, null, 2));
      console.log("File is saved successfully.")
    } catch (error) {
      console.log('Error saving data to JSON file:', error);
    }
  }
};

export const saveHolderWalletsToFile = (newData: string[], filename: string) => {
  const filePath: string = `wallets/${filename}.json`
  try {
    // Remove the existing file if it exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`File ${filePath} deleted.`);
    }

    // Write the new data to the file
    fs.writeFileSync(filePath, JSON.stringify(newData, null, 2));
    console.log("File is saved successfully.");

  } catch (error) {
    console.log('Error saving data to JSON file:', error);
  }
};

export const saveBundlerWalletsToFile = (newData: string[], filename: string) => {
  const filePath: string = `wallets/${filename}.json`
  try {
    // Remove the existing file if it exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`File ${filePath} deleted.`);
    }

    // Write the new data to the file
    fs.writeFileSync(filePath, JSON.stringify(newData, null, 2));
    console.log("File is saved successfully.");

  } catch (error) {
    console.log('Error saving data to JSON file:', error);
  }
};

export const saveHolderTokenAmountToFile = (newData: number[], filename: string = "tokenHoldingPercents") => {
  const filePath: string = `wallets/${filename}.json`
  try {
    // Remove the existing file if it exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`File ${filePath} deleted.`);
    }

    // Write the new data to the file
    fs.writeFileSync(filePath, JSON.stringify(newData, null, 2));
    console.log("File is saved successfully.");

  } catch (error) {
    console.log('Error saving data to JSON file:', error);
  }
};

export const saveBundlerTokenAmountToFile = (newData: number[], filename: string = "tokenBundlingPercents") => {
  const filePath: string = `wallets/${filename}.json`
  try {
    // Remove the existing file if it exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`File ${filePath} deleted.`);
    }

    // Write the new data to the file
    fs.writeFileSync(filePath, JSON.stringify(newData, null, 2));
    console.log("File is saved successfully.");

  } catch (error) {
    console.log('Error saving data to JSON file:', error);
  }
};

export const saveSwapSolAmountToFile = (newData: number[], filename: string = "swapAmounts") => {
  const filePath: string = `wallets/${filename}.json`
  try {
    // Remove the existing file if it exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`File ${filePath} deleted.`);
    }

    // Write the new data to the file
    fs.writeFileSync(filePath, JSON.stringify(newData, null, 2));
    console.log("File is saved successfully.");

  } catch (error) {
    console.log('Error saving data to JSON file:', error);
  }
};

// Function to read JSON file
export function readVolumeWalletDataJson(filename: string = "wallets/volumeWallets.json"): Data[] {
  if (!fs.existsSync(filename)) {
      // If the file does not exist, create an empty array
      fs.writeFileSync(filename, '[]', 'utf-8');
  }
  const data = fs.readFileSync(filename, 'utf-8');
  return JSON.parse(data) as Data[];
}

// Function to read JSON file
export function readHolderWalletDataJson(filename: string = "wallets/holderWallets.json"): Data[] {
  if (!fs.existsSync(filename)) {
      // If the file does not exist, create an empty array
      fs.writeFileSync(filename, '[]', 'utf-8');
  }
  const data = fs.readFileSync(filename, 'utf-8');
  return JSON.parse(data) as Data[];
}

// export function writeJson(data: Data[], filename: string = "wallets/holderWallets.json",): void {
//   fs.writeFileSync(filename, JSON.stringify(data, null, 4), 'utf-8');
// }

// let rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout
// })

export const securityCheckWaiting = () => {
  // rl.question('\x1b[32mpress Enter key to continue\x1b[0m', (answer: string) => {
  
  setTimeout(()=>security_checks(), 3000);  
  // })
  // rl.close()
}

export const prepareBundleWaiting = () => {
  // rl.question('\x1b[32mpress Enter key to continue\x1b[0m', (answer: string) => {
    setTimeout(()=>prepare_bundle(), 3000);  
    // prepare_bundle()
  // })
  // rl.close()
}

export const solGatherWaiting = () => {
  // rl.question('\x1b[32mpress Enter key to continue\x1b[0m', (answer: string) => {
    setTimeout(()=>gather(), 3000);  

    // gather()
  // })
  // rl.close()
}

export const tokenLaunchWaiting = () => {
  // rl.question('\x1b[32mpress Enter key to continue\x1b[0m', (answer: string) => {
    setTimeout(()=>token_launch(), 3000);  

    // token_launch()
  // })
  // rl.close()
}

export const tokenHoldersWaiting = () => {
  // rl.question('\x1b[32mpress Enter key to continue\x1b[0m', (answer: string) => {
    setTimeout(()=>token_holders(), 3000);  

    // token_holders()
  // })
  // rl.close()
}

export const sellBuyWaiting = () => {
  // rl.question('\x1b[32mpress Enter key to continue\x1b[0m', (answer: string) => {
    setTimeout(()=>sell_buy(), 3000);  

    // sell_buy()
  // })
  // rl.close()
}

export const balanceCheckWaiting = () => {
  // rl.question('\x1b[32mpress Enter key to continue\x1b[0m', (answer: string) => {
    setTimeout(()=>balances(), 5000);  

    // balances()
  // })
  // rl.close()
}

export const mainMenuWaiting = () => {
  // rl.question('\x1b[32mpress Enter key to continue\x1b[0m', (answer: string) => {

    init()
  // })
}

