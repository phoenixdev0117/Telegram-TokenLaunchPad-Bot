import { AddressLookupTableProgram, ComputeBudgetProgram, Connection, Keypair, PublicKey, sendAndConfirmRawTransaction, SignatureStatus, Transaction, TransactionConfirmationStatus, TransactionInstruction, TransactionMessage, TransactionSignature, VersionedTransaction } from "@solana/web3.js"
import {
    DEVNET_PROGRAM_ID,
    jsonInfo2PoolKeys,
    Liquidity,
    MAINNET_PROGRAM_ID,
    MARKET_STATE_LAYOUT_V3, LiquidityPoolKeys,
    Token, TokenAmount, ZERO, ONE, TEN,
    TOKEN_PROGRAM_ID, parseBigNumberish, bool,
    buildSimpleTransaction,
    TxVersion,
    Percent
} from "@raydium-io/raydium-sdk"
import { getAssociatedTokenAddress, getAssociatedTokenAddressSync, getMint, NATIVE_MINT, unpackMint } from "@solana/spl-token";
import bs58 from "bs58"
import BN from "bn.js"

import {   outputBalance, prepareBundleWaiting, readBundlerWallets, readJson, readLUTAddressFromFile, readSwapAmounts, readWallets, retrieveEnvVariable, saveDataToFile, sleep } from "./utils"
import {
    getTokenAccountBalance,
    assert,
    getWalletTokenAccount,
} from "./get_balance";
import { build_swap_instructions, build_create_pool_instructions } from "./build_a_sendtxn";
import {
    connection,
    addLookupTableInfo, cluster,
    lookupTableCache,
    delay_pool_open_time, DEFAULT_TOKEN
} from "../config";
import {
    quote_Mint_amount,
    input_baseMint_tokens_percentage,
    bundlerWalletName,
    batchSize,
    LP_wallet_keypair,
    Bundler_provider_wallet_keypair
} from "../settings"
import { BotSendMessage } from "..";

const programId = cluster == "devnet" ? DEVNET_PROGRAM_ID : MAINNET_PROGRAM_ID
const SIGNER_WALLET = Bundler_provider_wallet_keypair

const createAndSendV0Tx = async (txInstructions: TransactionInstruction[]) => {
    // Step 1 - Fetch Latest Blockhash
    let latestBlockhash = await connection.getLatestBlockhash();
    // BotSendMessage(`   ✅ - Fetched latest blockhash. Last valid height: ${latestBlockhash.lastValidBlockHeight}`);

    // Step 2 - Generate Transaction Message
    const messageV0 = new TransactionMessage({
        payerKey: SIGNER_WALLET.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: txInstructions
    }).compileToV0Message();
    // BotSendMessage(`   ✅ - Compiled transaction message`);
    const transaction = new VersionedTransaction(messageV0);

    // Step 3 - Sign your transaction with the required `Signers`
    transaction.sign([SIGNER_WALLET]);
    // BotSendMessage(`   ✅ - Transaction Signed by the wallet ${(SIGNER_WALLET.publicKey).toBase58()}`);

    // Step 4 - Send our v0 transaction to the cluster
    const txid = await connection.sendTransaction(transaction, { maxRetries: 5 });
    // BotSendMessage("   ✅ - Transaction sent to network");

    // Step 5 - Confirm Transaction 
    const confirmation = await confirmTransaction(connection, txid);
    // if (confirmation.value.err) { throw new Error("   ❌ - Transaction not confirmed.") }
    BotSendMessage(`🎉 Transaction successfully confirmed!: https://explorer.solana.com/tx/${txid}${cluster == "devnet" ? "?cluster=devnet" : ""}`);
}

async function confirmTransaction(
    connection: Connection,
    signature: TransactionSignature,
    desiredConfirmationStatus: TransactionConfirmationStatus = 'confirmed',
    timeout: number = 30000,
    pollInterval: number = 1000,
    searchTransactionHistory: boolean = false
): Promise<SignatureStatus> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
        const { value: statuses } = await connection.getSignatureStatuses([signature], { searchTransactionHistory });

        if (!statuses || statuses.length === 0) {
            throw new Error('Failed to get signature status');
        }

        const status = statuses[0];

        if (status === null) {
            // If status is null, the transaction is not yet known
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            continue;
        }

        if (status.err) {
            throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
        }

        if (status.confirmationStatus && status.confirmationStatus === desiredConfirmationStatus) {
            return status;
        }

        if (status.confirmationStatus === 'finalized') {
            return status;
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Transaction confirmation timeout after ${timeout}ms`);
}

export async function extendLutSimulate() {
    const wallets = readBundlerWallets(bundlerWalletName)
    const data = readJson()
    const lutAddress = readLUTAddressFromFile()

    const walletKPs = wallets.map((wallet: string) => Keypair.fromSecretKey(bs58.decode(wallet)));
    const lookupTableAddress = new PublicKey(lutAddress!);
    const LP_wallet_keypair = Keypair.fromSecretKey(new Uint8Array(bs58.decode(data.mainKp!)));

    BotSendMessage(`LP Wallet Address: ${LP_wallet_keypair.publicKey.toString()}`);
    BotSendMessage(`Bundler provider Address: ${Bundler_provider_wallet_keypair.publicKey.toString()}`);

    let params: any = {
        mint: data.mint ? new PublicKey(data.mint) : null,
        marketId: data.marketId ? new PublicKey(data.marketId) : null,
        poolId: data.poolId ? new PublicKey(data.poolId) : null,
        mainKp: data.mainKp,
        poolKeys: null,
        removed: data.removed
    }

    // ------- get pool keys
    BotSendMessage("------------- get pool keys for pool creation---------")

    const tokenAccountRawInfos_LP = await getWalletTokenAccount(
        connection,
        LP_wallet_keypair.publicKey
    )

    // console.log("token-here");

    if (!params.marketId) {
        BotSendMessage("Market Id is not set.");
        prepareBundleWaiting();
    } else {
        // console.log("prepareBundle-here");

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
        
        // console.log("getAccountInfo-here");

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

        saveDataToFile(params)

        // --------------------------------------------
        let quote_amount = quote_Mint_amount * 10 ** quoteDecimals;
        // -------------------------------------- Get balance
        let base_balance: number;
        let quote_balance: number;

        if (baseMint.toBase58() == "So11111111111111111111111111111111111111112") {
            base_balance = await connection.getBalance(LP_wallet_keypair.publicKey);
            if (!base_balance) return;
            console.log("SOL Balance:", base_balance);
        } else {
            const baseAta = await getAssociatedTokenAddressSync(baseMint, LP_wallet_keypair.publicKey)
            const temp = (await connection.getTokenAccountBalance(baseAta)).value.amount
            base_balance = Number(temp) || 0;
        }

        if (quoteMint.toString() == "So11111111111111111111111111111111111111112") {
            quote_balance = await connection.getBalance(LP_wallet_keypair.publicKey);
            if (!quote_balance) return;
            assert(
                quote_amount <= quote_balance,
                "Sol LP input is greater than current balance"
            );
        } else {
            // const temp = await getTokenAccountBalance(
            //     connection,
            //     LP_wallet_keypair.publicKey.toString(),
            //     quoteMint.toString()
            // );
            // quote_balance = temp || 0;
            const quoteAta = await getAssociatedTokenAddressSync(quoteMint, LP_wallet_keypair.publicKey)
            const temp = (await connection.getTokenAccountBalance(quoteAta)).value.amount
            base_balance = Number(temp) || 0;
        }

        let base_amount_input = Math.ceil(base_balance * input_baseMint_tokens_percentage);

        // step2: init new pool (inject money into the created pool)
        const lp_ix = await build_create_pool_instructions(
            programId,
            params.marketId,
            LP_wallet_keypair,
            tokenAccountRawInfos_LP,
            baseMint,
            baseDecimals,
            quoteMint,
            quoteDecimals,
            delay_pool_open_time,
            base_amount_input,
            quote_amount,
            lookupTableCache
        );

        const createPoolRecentBlockhash = (await connection.getLatestBlockhash().catch(async () => {
            return await connection.getLatestBlockhash().catch(getLatestBlockhashError => {
                console.log({ getLatestBlockhashError })
                return null
            })
        }))?.blockhash;
        if (!createPoolRecentBlockhash) return { Err: "Failed to prepare transaction" }

        const createPoolTransaction = (await buildSimpleTransaction({
            connection,
            makeTxVersion: TxVersion.V0,
            payer: LP_wallet_keypair.publicKey,
            innerTransactions: lp_ix,
            addLookupTableInfo: addLookupTableInfo,
            recentBlockhash: createPoolRecentBlockhash
        })) as VersionedTransaction[];
        createPoolTransaction[0].sign([LP_wallet_keypair]);

        // console.log((await connection.simulateTransaction(createPoolTransaction[0], undefined)));
        BotSendMessage("-------- Pool creation simulation [DONE] ---------\n")

        // ---- Swap info

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

        // let tokenAccountRawInfos_Swap

        const baseInfo = await getMint(connection, baseMint)
        if (baseInfo == null) {
            return null
        }

        const swapSolAmount = readSwapAmounts()

        for (let i = 0; i < 3; i++) {

            console.log("Processing transaction ", i + 1)

            const txs: TransactionInstruction[] = [];
            const ixs: TransactionInstruction[] = [
                ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 744_452 }),
                ComputeBudgetProgram.setComputeUnitLimit({ units: 1_183_504 })
            ]

            for (let j = 0; j < batchSize; j++) {
                // tokenAccountRawInfos_Swap = await getWalletTokenAccount(
                //     connection,
                //     walletKPs[i * 7 + j].publicKey
                // )

                const quoteAta = await getAssociatedTokenAddress(NATIVE_MINT, walletKPs[i * 7 + j].publicKey)
                const baseAta = await getAssociatedTokenAddress(baseMint, walletKPs[i * 7 + j].publicKey)

                const keypair = walletKPs[i * 7 + j]

                const { innerTransaction: innerBuyIx } = Liquidity.makeSwapFixedInInstruction(
                    {
                        poolKeys: poolKeys,
                        userKeys: {
                            tokenAccountIn: quoteAta,
                            tokenAccountOut: baseAta,
                            owner: keypair.publicKey,
                        },
                        amountIn: new BN(swapSolAmount[i * 7 + j] * 10 ** 9),
                        minAmountOut: 0,
                    },
                    poolKeys.version,
                );
                ixs.push(...innerBuyIx.instructions)
            }

            const buyRecentBlockhash1 = (await connection.getLatestBlockhash().catch(async () => {
                return await connection.getLatestBlockhash().catch(getLatestBlockhashError => {
                    console.log({ getLatestBlockhashError })
                    return null
                })
            }))?.blockhash;
            if (!buyRecentBlockhash1) return { Err: "Failed to prepare transaction" }

            // Step: Adding missing addresses from transaction message

            const swapVersionedTransaction1 = new VersionedTransaction(
                new TransactionMessage({
                    payerKey: LP_wallet_keypair.publicKey,
                    recentBlockhash: buyRecentBlockhash1,
                    instructions: ixs,
                }).compileToV0Message()
            );
            const accountKeys = swapVersionedTransaction1.message.staticAccountKeys
            const lookupTable = (await connection.getAddressLookupTable(lookupTableAddress)).value;
            const lutAddresses = lookupTable?.state.addresses
            const lutAddressesStrings = lutAddresses?.map(address => address.toString());

            const missingAddresses: PublicKey[] = []
            for (let i = 0; i < accountKeys.length; i++) {
                const accountKey = accountKeys[i].toBase58()
                if (!lutAddressesStrings?.includes(accountKey)) {
                    missingAddresses.push(accountKeys[i])
                }
            }

            if (missingAddresses.length > 0) {
                BotSendMessage(`Number of missing addresses: ${missingAddresses.length}`)
                try {
                    const numMissing = Math.ceil(missingAddresses.length / 20)
                    for (let i = 0; i < numMissing; i++) {
                        const missingSubAddresses = missingAddresses.slice(i * 20, missingAddresses.length > (i + 1) * 20 ? (i + 1) * 20 : missingAddresses.length)
                        const addAddressesInstruction = AddressLookupTableProgram.extendLookupTable({
                            payer: Bundler_provider_wallet_keypair.publicKey,
                            authority: Bundler_provider_wallet_keypair.publicKey,
                            lookupTable: lookupTableAddress,
                            addresses: missingSubAddresses,
                        });
                        await createAndSendV0Tx([
                            ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }),
                            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 500_000 }),
                            addAddressesInstruction]);
                        BotSendMessage("Successfully added extra addresses.")
                        await sleep(5000)
                    }
                } catch (error) {
                    BotSendMessage("Error in extending missing addresses. Please retry it by pressing Enter.")
                    console.log(error)
                    return
                }
            }

            if (missingAddresses.length !== 0) await sleep(40000)

            try {
                const buyRecentBlockhash = (await connection.getLatestBlockhash().catch(async () => {
                    return await connection.getLatestBlockhash().catch(getLatestBlockhashError => {
                        console.log({ getLatestBlockhashError })
                        return null
                    })
                }))?.blockhash;
                if (!buyRecentBlockhash) return { Err: "Failed to prepare transaction" }
                const swapVersionedTransaction = new VersionedTransaction(
                    new TransactionMessage({
                        payerKey: Bundler_provider_wallet_keypair.publicKey,
                        recentBlockhash: buyRecentBlockhash,
                        instructions: ixs,
                    }).compileToV0Message([lookupTable!])
                );

                BotSendMessage(`Transaction size with address lookup table: ${swapVersionedTransaction.serialize().length} bytes`);

                const signers = walletKPs.slice(i * batchSize, (i + 1) * batchSize)
                swapVersionedTransaction.sign(signers)
                swapVersionedTransaction.sign([Bundler_provider_wallet_keypair])

                BotSendMessage("-------- swap instructions [DONE] ---------\n")

                console.log((await connection.simulateTransaction(swapVersionedTransaction)))
                BotSendMessage(`------------- Simulation ${i + 1} Successful ---------`);
            } catch (error) {
                BotSendMessage("\nYou need to wait more time to use Lookuptable you just added, so please press Enter retry simulation.")
                prepareBundleWaiting()
                return
            }
        }

        await outputBalance(LP_wallet_keypair.publicKey)
        await outputBalance(Bundler_provider_wallet_keypair.publicKey)

        BotSendMessage("------------- All Simulation Successful ---------");
        prepareBundleWaiting()
    }
}