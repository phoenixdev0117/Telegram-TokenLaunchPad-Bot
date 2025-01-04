import { ComputeBudgetProgram, Keypair, PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js"
import {
    DEVNET_PROGRAM_ID,
    jsonInfo2PoolKeys,
    Liquidity,
    MAINNET_PROGRAM_ID,
    MARKET_STATE_LAYOUT_V3, LiquidityPoolKeys,
} from "@raydium-io/raydium-sdk"
import { getAssociatedTokenAddress, getMint, NATIVE_MINT, unpackMint } from "@solana/spl-token";
import bs58 from "bs58"
import {   outputBalance, readBundlerWallets, readJson, readLUTAddressFromFile, sellBuyWaiting, sleep } from "../src/utils"
import {
    connection,
    cluster,
} from "../config";
import {
    bundlerWalletName,
    batchSize,
    bundleWalletNum,
    Bundler_provider_wallet_keypair,
    LP_wallet_keypair
} from "../settings"

import { executeVersionedTx } from "../src/execute";
import { jitoWithAxios } from "../src/jitoWithAxios";
import { rl } from "../menu/menu";
import { BotSendMessage, bot } from "..";

const programId = cluster == "devnet" ? DEVNET_PROGRAM_ID : MAINNET_PROGRAM_ID

export async function manual_part_sell() {
    const wallets = readBundlerWallets(bundlerWalletName)
    const data = readJson()
    const lutAddress = readLUTAddressFromFile()

    const walletKPs = wallets.map((wallet: string) => Keypair.fromSecretKey(bs58.decode(wallet)));
    const lookupTableAddress = new PublicKey(lutAddress!);
    // const LP_wallet_keypair = Keypair.fromSecretKey(new Uint8Array(bs58.decode(data.mainKp!)));

    BotSendMessage(`Main Wallet Address: ${LP_wallet_keypair.publicKey.toString()}`);
    BotSendMessage(`Bundler Wallet Address: ${Bundler_provider_wallet_keypair.publicKey.toString()}`);

    let totalTokenBalance = 0
    const baseMint = new PublicKey(data.mint!)

    for (let i = 0; i < bundleWalletNum; i++) {
        const baseAta = await getAssociatedTokenAddress(baseMint, walletKPs[i].publicKey)
        const tokenBalance = (await connection.getTokenAccountBalance(baseAta)).value.uiAmount
        if (tokenBalance) totalTokenBalance = totalTokenBalance + tokenBalance
    }
    BotSendMessage(`Total Token Balance: ${totalTokenBalance}`)
    BotSendMessage("Please input the % of the token to sell.")

    let params: any = {
        mint: data.mint ? new PublicKey(data.mint) : null,
        marketId: data.marketId ? new PublicKey(data.marketId) : null,
        poolId: data.poolId ? new PublicKey(data.poolId) : null,
        mainKp: data.mainKp,
        poolKeys: data.poolKeys,
        removed: data.removed
    }

    BotSendMessage(`\t[Percent of total supply] - Sell Amount (if you want to go back, press c and press enter) : `)

    // rl.question("\t[Percent of total supply] - Sell Amount (if you want to go back, press c and press enter) : ", async (answer: string) => {
    bot.on("message", async (msg) => {
        var _a;
        const chatId = msg.chat.id;
        const USER_ID = chatId;
        const userID = msg.from?.id;
        const answer: string | undefined = msg.text ?? '';
        if (answer == 'c') {
            sellBuyWaiting()
            return
        }

        let sellPercentAmount = parseFloat(answer);

        if (!params.marketId) {
            BotSendMessage("Market Id is not set.");
            sellBuyWaiting();
        } else {
            const marketBufferInfo = await connection.getAccountInfo(params.marketId);
            if (!marketBufferInfo) return;
            const {
                baseMint,
                quoteMint,
                baseLotSize,
                quoteLotSize,
                baseVault: marketBaseVault,
                quoteVault: marketQuoteVault,
                bids: marketBids,
                asks: marketAsks,
                eventQueue: marketEventQueue
            } = MARKET_STATE_LAYOUT_V3.decode(marketBufferInfo.data);

            const accountInfo_base = await connection.getAccountInfo(baseMint);
            if (!accountInfo_base) return;
            const baseTokenProgramId = accountInfo_base.owner;
            const baseDecimals = unpackMint(
                baseMint,
                accountInfo_base,
                baseTokenProgramId
            ).decimals;

            const accountInfo_quote = await connection.getAccountInfo(quoteMint);
            if (!accountInfo_quote) return;
            const quoteTokenProgramId = accountInfo_quote.owner;
            const quoteDecimals = unpackMint(
                quoteMint,
                accountInfo_quote,
                quoteTokenProgramId
            ).decimals;

            const associatedPoolKeys = await Liquidity.getAssociatedPoolKeys({
                version: 4,
                marketVersion: 3,
                baseMint,
                quoteMint,
                baseDecimals,
                quoteDecimals,
                marketId: params.marketId,
                programId: programId.AmmV4,
                marketProgramId: programId.OPENBOOK_MARKET,
            });
            // const { id: ammId, lpMint } = associatedPoolKeys;
            params.poolId = associatedPoolKeys.id
            params.poolKeys = associatedPoolKeys

            // saveDataToFile(params)

            let versionedTxs: VersionedTransaction[] = []

            const targetPoolInfo = {
                id: associatedPoolKeys.id.toString(),
                baseMint: associatedPoolKeys.baseMint.toString(),
                quoteMint: associatedPoolKeys.quoteMint.toString(),
                lpMint: associatedPoolKeys.lpMint.toString(),
                baseDecimals: associatedPoolKeys.baseDecimals,
                quoteDecimals: associatedPoolKeys.quoteDecimals,
                lpDecimals: associatedPoolKeys.lpDecimals,
                version: 4,
                programId: associatedPoolKeys.programId.toString(),
                authority: associatedPoolKeys.authority.toString(),
                openOrders: associatedPoolKeys.openOrders.toString(),
                targetOrders: associatedPoolKeys.targetOrders.toString(),
                baseVault: associatedPoolKeys.baseVault.toString(),
                quoteVault: associatedPoolKeys.quoteVault.toString(),
                withdrawQueue: associatedPoolKeys.withdrawQueue.toString(),
                lpVault: associatedPoolKeys.lpVault.toString(),
                marketVersion: 3,
                marketProgramId: associatedPoolKeys.marketProgramId.toString(),
                marketId: associatedPoolKeys.marketId.toString(),
                marketAuthority: associatedPoolKeys.marketAuthority.toString(),
                marketBaseVault: marketBaseVault.toString(),
                marketQuoteVault: marketQuoteVault.toString(),
                marketBids: marketBids.toString(),
                marketAsks: marketAsks.toString(),
                marketEventQueue: marketEventQueue.toString(),
                lookupTableAccount: PublicKey.default.toString(),
            };

            const poolKeys = jsonInfo2PoolKeys(targetPoolInfo) as LiquidityPoolKeys;

            BotSendMessage("\n -------- Now getting swap instructions --------");

            const baseInfo = await getMint(connection, baseMint)
            if (baseInfo == null) {
                return null
            }

            // const baseDecimal = baseInfo.decimals

            // const keys = await derivePoolKeys(new PublicKey(data.marketId!));

            for (let i = 0; i < 3; i++) {

                BotSendMessage(`Processing transaction ${i + 1}`)

                const txs: TransactionInstruction[] = [];
                const ixs: TransactionInstruction[] = [
                    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 744_452 }),
                    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_183_504 })
                ]

                for (let j = 0; j < batchSize; j++) {

                    // const walletTokenAccounts = await getWalletTokenAccount(connection, walletKPs[i * 7 + j].publicKey)

                    const quoteAta = await getAssociatedTokenAddress(NATIVE_MINT, walletKPs[i * 7 + j].publicKey)
                    const baseAta = await getAssociatedTokenAddress(baseMint, walletKPs[i * 7 + j].publicKey)
                    const tokenAmount = (await connection.getTokenAccountBalance(baseAta)).value
                    const tokenBalance = tokenAmount.uiAmount
                    const tokenDecimal = tokenAmount.decimals
                    const sellAmount = Math.floor(tokenBalance! * sellPercentAmount / 100 * 10 ** tokenDecimal)
                    console.log(sellAmount)

                    const keypair = walletKPs[i * 7 + j]

                    if (tokenBalance) {
                        const { innerTransaction: innerBuyIx } = Liquidity.makeSwapFixedInInstruction(
                            {
                                poolKeys: poolKeys,
                                userKeys: {
                                    tokenAccountIn: baseAta,
                                    tokenAccountOut: quoteAta,
                                    owner: keypair.publicKey,
                                },
                                amountIn: sellAmount.toString(),
                                minAmountOut: 0,
                            },
                            poolKeys.version,
                        );
                        ixs.push(...innerBuyIx.instructions)
                    }
                }

                const lookupTable = (await connection.getAddressLookupTable(lookupTableAddress)).value;

                if (!lookupTable) {
                    BotSendMessage("Error in fetching the data of the lookuptable.")
                }

                const buyRecentBlockhash = (await connection.getLatestBlockhash().catch(async () => {
                    return await connection.getLatestBlockhash().catch(getLatestBlockhashError => {
                        console.log({ getLatestBlockhashError })
                        return null
                    })
                }))?.blockhash;
                if (!buyRecentBlockhash) return { Err: "Failed to prepare transaction" }
                const swapVersionedTransaction = new VersionedTransaction(
                    new TransactionMessage({
                        payerKey: walletKPs[i * 7].publicKey,
                        recentBlockhash: buyRecentBlockhash,
                        instructions: ixs,
                    }).compileToV0Message([lookupTable!])
                );
                BotSendMessage(`Transaction size with address lookuptable: ${swapVersionedTransaction.serialize().length}bytes`);

                const signers = walletKPs.slice(i * batchSize, (i + 1) * batchSize)
                swapVersionedTransaction.sign(signers)

                BotSendMessage("-------- swap coin instructions [DONE] ---------\n")

                console.log((await connection.simulateTransaction(swapVersionedTransaction)))

                versionedTxs.push(swapVersionedTransaction)

                if (cluster == "devnet") {
                    const buySig = await executeVersionedTx(swapVersionedTransaction)
                    const tokenBuyTx = buySig ? `https://solscan.io/tx/${buySig}${cluster == "devnet" ? "?cluster=devnet" : ""}` : ''
                    BotSendMessage(`Token sold: ${tokenBuyTx}`)
                    BotSendMessage("\n*******************************************************************************************")
                }
            }

            // await outputBalance(LP_wallet_keypair.publicKey)
            await outputBalance(Bundler_provider_wallet_keypair.publicKey)
            // swap ix end ------------------------------------------------------------

            if (cluster == "mainnet") {
                BotSendMessage("------------- Bundle & Send ---------")
                BotSendMessage("Please wait for 30 seconds for bundle to be completely executed by all nearests available leaders!");
                let result;
                while (1) {
                    result = await jitoWithAxios(versionedTxs, Bundler_provider_wallet_keypair)
                    if (result.confirmed) {
                        BotSendMessage(`Bundle signature: ${result.jitoTxsignature}`)
                        break;
                    }
                }
                BotSendMessage("------------- Bundle Successfully done ----------");
            }

            await sleep(5000)

            totalTokenBalance = 0

            for (let i = 0; i < bundleWalletNum; i++) {
                const baseAta = await getAssociatedTokenAddress(baseMint, walletKPs[i].publicKey)
                const tokenBalance = (await connection.getTokenAccountBalance(baseAta)).value.uiAmount
                if (tokenBalance) totalTokenBalance = totalTokenBalance + tokenBalance
            }
            BotSendMessage(`Total Token Balance after partial sell: ${totalTokenBalance}`)

            sellBuyWaiting()
        }
    })
}