import readline from "readline"
import { logToFile } from "../src/utils";
import { BotSendMessage } from "..";

export const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

export const screen_clear = () => {
    console.clear();
}

export const main_menu_display = () => {
    BotSendMessage('\t[1] - Token Launch');
    BotSendMessage('\t[2] - Token Holders');
    BotSendMessage('\t[3] - Token Sell & Buy');
    BotSendMessage('\t[4] - Gather Sol from bundler wallets');
    BotSendMessage('\t[5] - Balance of bundlers and holders');
    BotSendMessage('\t[6] - Distribute sol to bundlers');
    BotSendMessage('\t[7] - Exit');
}

export const token_launch_display = () => {
    BotSendMessage('\t[1] - Pre simulate before everything');
    BotSendMessage('\t[2] - Create Token');
    BotSendMessage('\t[3] - Security checks');
    BotSendMessage('\t[4] - Create Market');
    BotSendMessage('\t[5] - Prepare for Bundle');
    BotSendMessage('\t[6] - Create holder wallets');
    BotSendMessage('\t[7] - Create Pool And BundleBuy');
    BotSendMessage('\t[8] - Burn LP token');
    BotSendMessage('\t[9] - Back');
    BotSendMessage('\t[10] - Exit');
}

export const token_holders_display = () => {
    BotSendMessage('\t[1] - Distribute Token to HolderWallets');
    BotSendMessage('\t[2] - Gather selected Token to BundlerWallets');
    BotSendMessage('\t[3] - Gather all Token to BundlerWallets');
    BotSendMessage('\t[4] - Back');
    BotSendMessage('\t[5] - Exit');
}

export const token_sell_buy_display = () => {
    BotSendMessage('\t[1] - Sell tokens partially');
    BotSendMessage('\t[2] - Sell tokens from each Bundler');
    BotSendMessage('\t[3] - Rebuy tokens partially');
    BotSendMessage('\t[4] - Remove liquidity')
    BotSendMessage('\t[5] - Back');
    BotSendMessage('\t[6] - Exit');
}

export const gather_display = () => {
    BotSendMessage('\t[1] - Gather Sol from all bundler wallets');
    BotSendMessage('\t[2] - Gather Wsol from one bundler wallet');
    BotSendMessage('\t[3] - Back');
    BotSendMessage('\t[4] - Exit');
}

export const balances_display = () => {
    BotSendMessage('\t[1] - Show sol & token balances of bundlers')
    BotSendMessage('\t[2] - Show sol & token balances of holders')
    BotSendMessage('\t[3] - Back');
    BotSendMessage('\t[4] - Exit');
}

export const security_checks_display = () => {
    BotSendMessage('\t[1] - Remove Mint Authority');
    BotSendMessage('\t[2] - Freeze Authority');
    BotSendMessage('\t[3] - Back');
    BotSendMessage('\t[4] - Exit');
}

export const prepare_bundle_display = () => {
    BotSendMessage('\t[1] - Wallet Create');
    BotSendMessage('\t[2] - Create AssociatedTokenAccounts');
    BotSendMessage('\t[3] - Create LUT');
    BotSendMessage('\t[4] - Extend and Simulate tx size');
    BotSendMessage('\t[5] - Back');
    BotSendMessage('\t[6] - Exit');
}