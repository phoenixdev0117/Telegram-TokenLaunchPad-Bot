import bs58 from "bs58"
import { AddressLookupTableProgram, ComputeBudgetProgram, Connection, Keypair, PublicKey, SignatureStatus, TransactionConfirmationStatus, TransactionInstruction, TransactionMessage, TransactionSignature, VersionedTransaction } from "@solana/web3.js"
import { cluster, connection } from "../config";
import {   outputBalance, prepareBundleWaiting, readBundlerWallets, readJson, saveLUTAddressToFile, sleep } from "../src/utils";
import { Bundler_provider_wallet_keypair, bundlerWalletName, LP_wallet_keypair } from "../settings";
import { getAssociatedTokenAddressSync, NATIVE_MINT, unpackMint } from "@solana/spl-token";
import { Liquidity, MAINNET_PROGRAM_ID, MARKET_STATE_LAYOUT_V3 } from "@raydium-io/raydium-sdk";
import { derivePoolKeys } from "../src/poolAll";
import { BotSendMessage } from "..";

const data = readJson()
const SIGNER_WALLET = Bundler_provider_wallet_keypair

const createAndSendV0Tx = async (txInstructions: TransactionInstruction[]) => {
    try {
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
        console.log(await connection.simulateTransaction(transaction))
        // Step 4 - Send our v0 transaction to the cluster
        const txid = await connection.sendTransaction(transaction, { maxRetries: 5 });
        // BotSendMessage("   ✅ - Transaction sent to network");

        // Step 5 - Confirm Transaction 
        const confirmation = await confirmTransaction(connection, txid);
        // if (confirmation.value.err) { throw new Error("   ❌ - Transaction not confirmed.") }
        BotSendMessage(`🎉 Transaction successfully confirmed!: https://explorer.solana.com/tx/${txid}${cluster == "devnet" ? "?cluster=devnet" : ""}`);
    } catch (error) {
        BotSendMessage("There is an error in creating LUT. Press enter and retry this step again.")
        prepareBundleWaiting()
    }
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

async function createLUT() {
    try {
        const currentSlot = await connection.getSlot();
        console.log('currentSlot:', currentSlot);
        const slots = await connection.getBlocks(currentSlot - 200);
        if (slots.length < 100) {
            throw new Error(`Could find only ${slots.length} ${slots} on the main fork`);
        }
        const recentSlot = slots[0];

        const [lookupTableInst, lookupTableAddress] =
            AddressLookupTableProgram.createLookupTable({
                authority: SIGNER_WALLET.publicKey,
                payer: SIGNER_WALLET.publicKey,
                recentSlot: recentSlot,
            });

        // Step 2 - Log Lookup Table Address
        BotSendMessage(`Lookup Table Address: ${lookupTableAddress.toBase58()}`);

        // Step 3 - Generate a create transaction and send it to the network
        createAndSendV0Tx([
            ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }),
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 500_000 }),
            lookupTableInst]);
        BotSendMessage("Lookup Table Address created successfully!")
        BotSendMessage("Please wait for about 15 seconds...")
        await sleep(20000)
        return lookupTableAddress
    } catch (err) {
        BotSendMessage("Error in creating Lookuptable. Please retry this.")
        prepareBundleWaiting()
    }

}

async function addAddressesToTable(LOOKUP_TABLE_ADDRESS: PublicKey, mint: PublicKey) {
    const programId = MAINNET_PROGRAM_ID

    const wallets = readBundlerWallets(bundlerWalletName)

    const walletKPs: Keypair[] = wallets.map((wallet: string) => Keypair.fromSecretKey(bs58.decode(wallet)));
    const walletPKs: PublicKey[] = wallets.map((wallet: string) => (Keypair.fromSecretKey(bs58.decode(wallet))).publicKey);

    try {// Step 1 - Adding bundler wallets
        const addAddressesInstruction = AddressLookupTableProgram.extendLookupTable({
            payer: SIGNER_WALLET.publicKey,
            authority: SIGNER_WALLET.publicKey,
            lookupTable: LOOKUP_TABLE_ADDRESS,
            addresses: walletPKs,
        });
        await createAndSendV0Tx([
            ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }),
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 500_000 }),
            addAddressesInstruction]);
        BotSendMessage("Successfully added wallet addresses.")
        await sleep(20000)

        // Step 2 - Adding wallets' token ata
        BotSendMessage(`Adding atas for the token ${mint.toBase58()}`)
        const baseAtas: PublicKey[] = []
        for (const wallet of walletKPs) {
            const baseAta = getAssociatedTokenAddressSync(mint, wallet.publicKey)
            baseAtas.push(baseAta);
        }
        // console.log("Base atas address num to extend: ", baseAtas.length)
        const addAddressesInstruction1 = AddressLookupTableProgram.extendLookupTable({
            payer: SIGNER_WALLET.publicKey,
            authority: SIGNER_WALLET.publicKey,
            lookupTable: LOOKUP_TABLE_ADDRESS,
            addresses: baseAtas,
        });
        await createAndSendV0Tx([
            ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }),
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 500_000 }),
            addAddressesInstruction1]);
        BotSendMessage("Successfully added token ata addresses.")
        await sleep(5000)

        // Step 3 - Adding wallets' wsol ata
        const quoteAtas = []
        for (const wallet of walletKPs) {
            const quoteAta = getAssociatedTokenAddressSync(NATIVE_MINT, wallet.publicKey)
            quoteAtas.push(quoteAta);
            // console.log("Base atas address num to extend: ", baseAtas.length)
        }
        const addAddressesInstruction2 = AddressLookupTableProgram.extendLookupTable({
            payer: SIGNER_WALLET.publicKey,
            authority: SIGNER_WALLET.publicKey,
            lookupTable: LOOKUP_TABLE_ADDRESS,
            addresses: quoteAtas,
        });
        await createAndSendV0Tx([
            ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }),
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 500_000 }),
            addAddressesInstruction2]);
        BotSendMessage("Successfully added wsol ata addresses.")
        await sleep(10000)

        BotSendMessage("Lookup Table Address extended successfully!")
        BotSendMessage(`Lookup Table Entries: https://explorer.solana.com/address/${LOOKUP_TABLE_ADDRESS.toString()}/entries${cluster == "devnet" ? "?cluster=devnet" : ""}`)
    }
    catch (err) {
        BotSendMessage("There is an error in adding addresses in LUT. But it is ok, so you can continue to the next step by pressing Enter.")
        prepareBundleWaiting()
        return;
    }
}

export const create_extend_lut = async () => {

    const wallets = readBundlerWallets(bundlerWalletName)
    const walletKPs = wallets.map((wallet: string) => Keypair.fromSecretKey(bs58.decode(wallet)));
    const data = readJson()
    const mint = new PublicKey(data.mint!)

    try {
        BotSendMessage("Creating Address LookUpTable for our bundler.")
        await outputBalance(SIGNER_WALLET.publicKey)

        // Step 1 - Get a lookup table address and create lookup table instruction
        const lookupTableAddress = await createLUT()
        if (!lookupTableAddress) {
            BotSendMessage("Please retry creating Lookuptable.")
            prepareBundleWaiting()
            return
        }
        saveLUTAddressToFile(lookupTableAddress.toBase58())
        await outputBalance(SIGNER_WALLET.publicKey)

        BotSendMessage("Extending Address LookUpTable for our bundler.")
        // Step 2 - Generate adding addresses transactions
        await addAddressesToTable(lookupTableAddress, mint)
        await outputBalance(SIGNER_WALLET.publicKey)

        prepareBundleWaiting()
    } catch (err) {
        // BotSendMessage("Error occurred in creating lookuptable. Please retry this again.")
        prepareBundleWaiting()
    }

}