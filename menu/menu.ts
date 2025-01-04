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