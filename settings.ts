import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { UserToken } from './src/types';

// **************************************************** //
// ***************   SETTINGS   *********************** //
// **************************************************** //
// SD, You should set following values before you run the program.

// settings about token you are going to Mint
export const tokens: UserToken[] = [
  {
    name: 'Lion2025',
    symbol: 'lion2025',
    decimals: 9,
    description: `Lion2025 will change the world`,
    uiAmount: 80000000000,
    image: "./src/images/2.jpg",
    
    extensions: {
      website: "https://t.me/MoonDoge",
      twitter: "https://x.com/MoonDoge",
      telegram: "https://t.me/MoonDoge",
    
    },
    tags: [
      "Meme",
      "moon",
      "doge",
      "SOL",
      "SolanaTuesday",
      "HODL",
      "Memecoin",
      "Solana",
      "Token",
      "SolanaChain",
      "MintOnSolana",
      "Token",
      "DegenLife",

    ],
    creator: {
      name: "MoonDoge",
      site: "https://t.me/moonedoge"
    }
  }
]

// Main wallet to create token and pool, and so on
export const LP_wallet_private_key = "24qcaHHza3wpgJ6ehGNyPdbcgkvjirE1YzE3LXSc2jiUej9raxg9q7yTTshBB6kkb9uUgLmPMSJtEv4jQ46acF6L";
export const LP_wallet_keypair = Keypair.fromSecretKey(new Uint8Array(bs58.decode(LP_wallet_private_key)));
export const Bundler_provider_private_key = "38cV86dk5DBFrV2w7iZ3KgMCPWSUY3WS7Fe3rnWsk2mtSr2fdCjf4bFpGokz3jPVgj4CPq9t44Hqj8fjPn8EhK5f";
export const Bundler_provider_wallet_keypair = Keypair.fromSecretKey(new Uint8Array(bs58.decode(Bundler_provider_private_key)));
// amount of baseToken to put into the pool (0.5 is 50%, 1 is 100%)
export const input_baseMint_tokens_percentage = 1.00 //ABC-Mint amount of tokens you want to add in Lp e.g. 1 = 100%. 0.9= 90%

// amount of Sol to put into the Pool as liquidity
export let quote_Mint_amount =  1.00; //COIN-SOL, amount of SOL u want to add to Pool amount

// Total holding percent of token in bundlers (50 is 50% of total supply)
export const bundlerHoldingPercent = 72;

// Max amount of Token in holder wallets (1 is 1%)
export const holderTokenAmountMax =  1.1;

// Min amount of Token in holder wallets (1 is 1%)
export const holderTokenAmountMin =  0.4;

// number of holder wallets to distribute
export const distNum = 4

// Extra sol to retain in bundler wallets - Rent Fees
export const extra_sol_amount = 0.04;

// number of wallets in each transaction **DONT CHANGE !!**
export const batchSize = 7

// percentage of tokens to keep in bundler wallets when distribute
export const remaining_token_percent = 19

// name of file to save bundler wallets
export const bundlerWalletName = "wallets"

// name of file to save bundler wallets
export const holderWalletName = "holders"

// percent of LP tokens to burn
export const burnLpQuantityPercent = 100   // 70 is 70% of total lp token supply

// number of wallets to bundle buy DONT CHANGE !!
export const bundleWalletNum = batchSize * 3

// number of holder wallets
export const distWalletNum = distNum * bundleWalletNum

